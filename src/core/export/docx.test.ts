import { describe, expect, it } from 'vitest';
import { shownText, xmlParts } from '../../../tests/support/export-parts';
import { readZip } from '../../../tests/support/read-zip';
import { assertWellFormedXml } from '../../../tests/support/xml-check';
import type { ExportRequest } from './book';
import { docx } from './docx';

const CHAPTER = [
  '# The Scarf',
  '',
  '"Look,"[^1] he said. She ==mended== it, **twice**, ~~once~~.[^1]',
  '',
  '***',
  '',
  '- one',
  '  1. a',
  '  2. b',
  '- two',
  '',
  '1. first',
  '',
  '> quoted [link](https://example.com)',
  '',
  '```',
  'code\tline',
  '  indented',
  '```',
  '',
  '| a | b |',
  '|---|---|',
  '| 1 |',
  '',
  '[^1]: The note, with [a link](https://example.org).',
  '[^2]: Never referred to.',
].join('\n');

const BOOK: ExportRequest = {
  title: 'A Mended Scarf',
  notes: [
    { title: 'Mending', markdown: CHAPTER },
    { title: 'Fire', markdown: 'Words.' },
  ],
  book: true,
  quotes: 'curly',
  language: 'en-US',
  key: 'v/b',
  date: new Date(Date.UTC(2026, 9, 20)),
};

const attrs = (xml: string, element: string, name: string) =>
  [...xml.matchAll(new RegExp(`<${element}\\b[^>]*?\\b${name}="([^"]*)"`, 'gu'))].map(
    (m) => m[1] as string,
  );

describe('docx', () => {
  const zip = docx(BOOK);
  const read = readZip(zip);
  const parts = xmlParts(zip);
  const document = read.text('word/document.xml');
  const footnotes = read.text('word/footnotes.xml');
  const styles = read.text('word/styles.xml');
  const rels = read.text('word/_rels/document.xml.rels');

  it('is well-formed XML, every part, its prefixes declared', () => {
    expect(parts.size).toBe(11);
    for (const [name, xml] of parts) expect(() => assertWellFormedXml(xml), name).not.toThrow();
  });

  it('names a content type for every part, and every relationship’s target is there', () => {
    const types = read.text('[Content_Types].xml');
    for (const name of read.names.filter(
      (n) => !n.endsWith('.rels') && n !== '[Content_Types].xml',
    )) {
      expect(types, name).toContain(`PartName="/${name}"`);
    }
    for (const target of attrs(rels, 'Relationship', 'Target').filter(
      (t) => !t.startsWith('http'),
    )) {
      expect(read.names).toContain(`word/${target}`);
    }
    expect(read.text('_rels/.rels')).toContain('Target="word/document.xml"');
  });

  it('uses only the styles it defines, and Word’s own names for them', () => {
    const defined = new Set(attrs(styles, 'w:style', 'w:styleId'));
    const used = [
      ...attrs(document, 'w:pStyle', 'w:val'),
      ...attrs(document, 'w:rStyle', 'w:val'),
      ...attrs(footnotes, 'w:pStyle', 'w:val'),
      ...attrs(footnotes, 'w:rStyle', 'w:val'),
    ];
    for (const style of used) expect(defined, style).toContain(style);
    expect(styles).toContain('w:styleId="Heading1"><w:name w:val="heading 1"/>');
    expect(styles).toContain('w:styleId="FootnoteText"><w:name w:val="footnote text"/>');
  });

  it('numbers lists only by numberings it defines; each numbered list starts at 1', () => {
    const numbering = read.text('word/numbering.xml');
    const defined = new Set(attrs(numbering, 'w:num', 'w:numId'));
    const used = attrs(document, 'w:numId', 'w:val');
    expect(new Set(used)).toEqual(new Set(['1', '2', '3']));
    for (const id of used) expect(defined).toContain(id);
    expect(numbering).toContain(
      '<w:num w:numId="2"><w:abstractNumId w:val="1"/><w:lvlOverride w:ilvl="1"><w:startOverride w:val="1"/>',
    );
    expect(numbering).toContain(
      '<w:num w:numId="3"><w:abstractNumId w:val="1"/><w:lvlOverride w:ilvl="0"><w:startOverride w:val="1"/>',
    );
  });

  it('makes each mark its own footnote, and a note never referred to a paragraph at the chapter’s end', () => {
    const refs = attrs(document, 'w:footnoteReference', 'w:id');
    expect(refs).toEqual(['1', '2']);
    expect(attrs(footnotes, 'w:footnote', 'w:id')).toEqual(['-1', '0', '1', '2']);
    expect(shownText(footnotes)).toBe('The note, with a link. The note, with a link.');
    expect(shownText(document)).toContain('2. Never referred to. Fire');
  });

  it('puts a note only a footnote refers to at the chapter’s end: Word has no footnote in a footnote', () => {
    const chain = readZip(
      docx({ ...BOOK, notes: [{ title: 'T', markdown: 'A[^1].\n\n[^1]: B[^2].\n[^2]: Deeper.' }] }),
    );
    const document = chain.text('word/document.xml');
    expect(attrs(document, 'w:footnoteReference', 'w:id')).toEqual(['1']);
    expect(shownText(chain.text('word/footnotes.xml'))).toBe('B2.');
    expect(shownText(document)).toMatch(/A\. 2\. Deeper\.$/u);
  });

  it('links to the web through its relationships, in the body and in footnotes', () => {
    const links = attrs(document, 'w:hyperlink', 'r:id');
    for (const id of [...links, ...attrs(footnotes, 'w:hyperlink', 'r:id')]) {
      expect(rels).toContain(`Id="${id}"`);
      expect(read.text('word/_rels/footnotes.xml.rels')).toContain(`Id="${id}"`);
    }
    expect(rels).toContain('Target="https://example.com" TargetMode="External"');
  });

  it('keeps the words, a book’s title first, each chapter under Heading 1', () => {
    expect(shownText(document)).toMatch(
      /^A Mended Scarf The Scarf “Look,” he said\. She mended it, twice, once\. \* \* \* one a b two first quoted link code line indented a b 1 2\. Never referred to\. Fire Words\.$/u,
    );
    expect(document).toContain(
      '<w:r><w:rPr><w:highlight w:val="yellow"/></w:rPr><w:t xml:space="preserve">mended</w:t></w:r>',
    );
    expect(document).toContain(
      '<w:t xml:space="preserve">code</w:t><w:tab/><w:t xml:space="preserve">line</w:t><w:br/><w:t xml:space="preserve">  indented</w:t>',
    );
    expect(attrs(document, 'w:pStyle', 'w:val').filter((s) => s === 'Heading1')).toHaveLength(2);
  });

  it('pads a short table row, so every row has every column', () => {
    expect(document.match(/<w:tc>/gu)).toHaveLength(4);
    expect(document.match(/<w:gridCol /gu)).toHaveLength(2);
  });

  it('sets the page by the region: letter in the US, A4 elsewhere; no number on a title page', () => {
    expect(document).toContain('<w:pgSz w:w="12240" w:h="15840"/>');
    expect(document).toContain('<w:titlePg/>');
    const a4 = readZip(docx({ ...BOOK, language: 'fr-FR', book: false })).text('word/document.xml');
    expect(a4).toContain('<w:pgSz w:w="11906" w:h="16838"/>');
    expect(a4).not.toContain('<w:titlePg/>');
    // A note's heading opens the document: no page break before it.
    expect(a4).toMatch(
      /^[\s\S]*?<w:body><w:p><w:pPr><w:pStyle w:val="Heading1"\/><w:pageBreakBefore w:val="0"\/>/u,
    );
  });
});
