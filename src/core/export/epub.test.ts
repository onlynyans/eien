import { describe, expect, it } from 'vitest';
import { shownText, xmlParts } from '../../../tests/support/export-parts';
import { readZip } from '../../../tests/support/read-zip';
import { assertSoundXhtml, assertWellFormedXml } from '../../../tests/support/xml-check';
import type { ExportRequest } from './book';
import { epub } from './epub';

const BOOK: ExportRequest = {
  title: 'A Mended <Scarf>',
  notes: [
    { title: 'Mending', markdown: '# The *Scarf*\n\n"Look."[^1]\n\n[^1]: A note.\n\n[^2]: Never.' },
    { title: 'Fire & Ice', markdown: 'Just words.' },
  ],
  book: true,
  quotes: 'curly',
  language: 'en-GB',
  key: 'Vault/Fic/A Mended Scarf',
  date: new Date(Date.UTC(2026, 9, 20, 16, 40, 2, 500)),
};

describe('epub', () => {
  const zip = epub(BOOK);
  const read = readZip(zip);
  const parts = xmlParts(zip);
  const opf = read.text('OEBPS/content.opf');

  it('starts with its mimetype, stored, as readers look for it', () => {
    expect(read.names[0]).toBe('mimetype');
    expect(read.text('mimetype')).toBe('application/epub+zip');
    expect(read.text('META-INF/container.xml')).toContain('full-path="OEBPS/content.opf"');
  });

  it('lists every file it holds in its manifest, and holds every file listed', () => {
    const listed = [...opf.matchAll(/href="([^"]+)"/gu)].map((m) => `OEBPS/${m[1]}`).sort();
    const held = read.names.filter(
      (name) => name.startsWith('OEBPS/') && name !== 'OEBPS/content.opf',
    );
    expect(listed).toEqual([...held].sort());
  });

  it('reads the title page, then the chapters, in the book’s order', () => {
    const spine = [...opf.matchAll(/<itemref idref="([^"]+)"/gu)].map((m) => m[1]);
    expect(spine).toEqual(['title', 'c1', 'c2']);
    const nav = read.text('OEBPS/nav.xhtml');
    expect([...nav.matchAll(/<a href="([^"]+)">([^<]*)<\/a>/gu)].map((m) => [m[1], m[2]])).toEqual([
      ['chapter-1.xhtml', 'The Scarf'],
      ['chapter-2.xhtml', 'Fire &amp; Ice'],
    ]);
    expect(read.text('OEBPS/toc.ncx')).toContain('<text>Fire &amp; Ice</text>');
    expect(shownText(read.text('OEBPS/title.xhtml'))).toBe('A Mended <Scarf> A Mended <Scarf>');
  });

  it('has its metadata: identifier, title, language, modified to the second', () => {
    expect(opf).toMatch(
      /<dc:identifier id="book-id">urn:uuid:[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}<\/dc:identifier>/u,
    );
    expect(opf).toContain('<dc:title>A Mended &lt;Scarf&gt;</dc:title>');
    expect(opf).toContain('<dc:language>en-GB</dc:language>');
    expect(opf).toContain('<meta property="dcterms:modified">2026-10-20T16:40:02Z</meta>');
  });

  it('keeps its identifier when exported again, and another book has another', () => {
    const id = (request: ExportRequest) =>
      /urn:uuid:[^<]+/u.exec(readZip(epub(request)).text('OEBPS/content.opf'))?.[0];
    expect(id({ ...BOOK, date: new Date() })).toBe(id(BOOK));
    expect(id({ ...BOOK, key: 'Vault/Fic/Another' })).not.toBe(id(BOOK));
  });

  it('is well-formed XML, every part', () => {
    expect([...parts.keys()]).toHaveLength(7); // container, package, nav, ncx, title, two chapters
    for (const [name, xml] of parts) {
      const check = name.endsWith('.xhtml') ? assertSoundXhtml : assertWellFormedXml;
      expect(() => check(xml), name).not.toThrow();
    }
  });

  it('pops a footnote up from its mark, and keeps one never referred to in the flow', () => {
    const chapter = read.text('OEBPS/chapter-1.xhtml');
    expect(chapter).toContain(
      '<a class="noteref" epub:type="noteref" id="fnref1" href="#fn1">1</a>',
    );
    expect(chapter).toContain(
      '<aside epub:type="footnote" id="fn1">\n<p><a href="#fnref1">1.</a> A note.</p>\n</aside>',
    );
    expect(chapter).toContain('<div class="note" id="fn2">\n<p>2. Never.</p>\n</div>');
  });

  it('has no title page for a note, and a language it can name', () => {
    const note = readZip(
      epub({ ...BOOK, book: false, notes: [BOOK.notes[1] as never], language: 'not a tag!' }),
    );
    expect(note.names).not.toContain('OEBPS/title.xhtml');
    expect(note.text('OEBPS/content.opf')).toContain('<dc:language>en</dc:language>');
    expect(note.text('OEBPS/content.opf')).not.toContain('idref="title"');
  });
});
