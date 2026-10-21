// Adversarial: a book's exports (spec §8) over Markdown a writer may have.
// Each test holds the EPUB, the Word file and the PDF's page to what the
// spec promises ("every word as Eien's word count reads the note", the same
// in all three formats) or to what a reader needs (valid XHTML, a contents
// entry with words). Each one fails on the code as it stands.

import { describe, expect, it } from 'vitest';
import { shownText } from '../../../tests/support/export-parts';
import { readZip } from '../../../tests/support/read-zip';
import { assertWellFormedXml } from '../../../tests/support/xml-check';
import { countWords } from '../text';
import type { ExportRequest } from './book';
import { chapterOf } from './chapter';
import { docx } from './docx';
import { epub } from './epub';
import { printHtml } from './print-html';

const request = (markdown: string, title = 'Mending'): ExportRequest => ({
  title: 'A Mended Scarf',
  notes: [{ title, markdown }],
  book: true,
  quotes: 'curly',
  language: 'en-US',
  key: 'Vault/A Mended Scarf',
  date: new Date(0),
});

/** What each export shows of a one-chapter book: its chapter, its Word body and notes, its PDF page. */
function shown(markdown: string): { epub: string; word: string; pdf: string } {
  const book = request(markdown);
  const word = readZip(docx(book));
  const page = printHtml(book);
  return {
    epub: shownText(readZip(epub(book)).text('OEBPS/chapter-1.xhtml')),
    word: `${shownText(word.text('word/document.xml'))} ${shownText(word.text('word/footnotes.xml'))}`,
    // The page's body, as a browser shows it: its own entities read as HTML reads them.
    pdf: shownText(
      (page.split('<body>')[1] ?? '').replace(/&euro;/gu, '€').replace(/&eacute;/gu, 'é'),
    ),
  };
}

describe('words that never reach the exports', () => {
  it('keeps the words after a line that starts with "<?" (the word count counts them)', () => {
    const markdown = '<? she wondered, and stopped.\n\nShe mended the scarf twice.';
    expect(countWords(markdown)).toBeGreaterThan(5); // the page and the count have them
    const out = shown(markdown);
    expect(out.epub).toContain('mended the scarf');
    expect(out.word).toContain('mended the scarf');
    expect(out.pdf).toContain('mended the scarf');
  });

  it('keeps a footnote’s words when its text begins with "<!--" or a fence (the count reads them)', () => {
    const markdown = [
      'She mended it.[^1] Then the fire.[^2]',
      '',
      '[^1]: <!-- unfinished, she thought, and left it',
      '[^2]: ~~~ and so it ended ~~~',
    ].join('\n');
    // The word count reads the definitions' lines as words.
    expect(countWords(markdown)).toBeGreaterThan(14);
    const out = shown(markdown);
    for (const text of [out.epub, out.word, out.pdf]) {
      expect(text).toContain('unfinished, she thought');
      expect(text).toContain('and so it ended');
    }
  });

  it('shows an aliased [[wiki link]] as its alias, as Copy for AO3 does (spec §8)', () => {
    // Decided in the fixes for this pass: the count reads both sides ("Mending|the scarf"), as
    // Live shows them; a book, like AO3, gets the words a reader is meant to see.
    const out = shown('She wore [[Mending|the scarf]] again.');
    for (const text of [out.epub, out.word, out.pdf]) {
      expect(text).toContain('She wore the scarf again.');
      expect(text).not.toContain('Mending|');
    }
  });
});

describe('a footnote’s mark where Markdown keeps text as it is', () => {
  it('leaves a [[wiki link]] holding "[^1]" readable, not "&#x0F0001;"', () => {
    const out = shown('See [[Mending[^1]]] again.\n\n[^1]: A note.');
    for (const text of [out.epub, out.word, out.pdf]) {
      expect(text).not.toMatch(/#x0F0001/iu);
      expect(text).toContain('Mending');
    }
  });

  it('keeps a later definition of a label as its words: "[^1]: Second." (spec §8)', () => {
    const chapter = chapterOf(
      { title: 'T', markdown: 'Text.[^1]\n\n[^1]: First.\n\n[^1]: Second.' },
      'straight',
    );
    expect(chapter.blocks.at(-1)).toBe('<p>[^1]: Second.</p>');
  });
});

describe('the EPUB as a reader checks it', () => {
  it('stays well-formed XML when the words hold "R&D;" or "Q&A;" (the parser reads an entity)', () => {
    // The editor's parser takes "&" + letters, digits or "_" + ";" for an entity, kept as written;
    // only XML's five references, and numbers, may stand in XHTML.
    for (const markdown of ['We cut R&D; it hurt.', 'The Q&A; ran long.', 'Tom&Jerry_fans; met.']) {
      const xhtml = readZip(epub(request(markdown))).text('OEBPS/chapter-1.xhtml');
      expect(() => assertWellFormedXml(xhtml), markdown).not.toThrow();
    }
    for (const markdown of ['&#12345678; past Unicode', '&#x1234567; past Unicode']) {
      const xhtml = readZip(epub(request(markdown))).text('OEBPS/chapter-1.xhtml');
      expect(() => assertWellFormedXml(xhtml), markdown).not.toThrow();
    }
  });

  it('never puts a link inside a link: a footnote’s mark in a link’s words', () => {
    const xhtml = readZip(
      epub(request('Read [the report[^1]](https://example.com) first.\n\n[^1]: A note.')),
    ).text('OEBPS/chapter-1.xhtml');
    let depth = 0;
    let deepest = 0;
    for (const tag of xhtml.matchAll(/<(\/?)a\b[^>]*>/gu)) {
      depth += tag[1] ? -1 : 1;
      deepest = Math.max(deepest, depth);
    }
    expect(deepest).toBe(1); // HTML: an <a> may hold no <a>
  });

  it('gives every contents entry words, even for a heading of a character XML can’t hold', () => {
    const zip = readZip(epub(request('# &#1;\n\nShe mended it.', 'Mending')));
    const nav = zip.text('OEBPS/nav.xhtml');
    const entries = [...nav.matchAll(/<a href="[^"]*">([\s\S]*?)<\/a>/gu)].map((m) =>
      shownText(m[1] as string),
    );
    expect(entries).toHaveLength(1);
    expect(entries[0]).not.toBe(''); // an empty <a> in the nav is an error to EPUBCheck
    expect(shownText(zip.text('OEBPS/toc.ncx'))).toContain('Mending');
  });
});

describe('the same in all three formats', () => {
  it('keeps an ordered list’s first number: "1994. The year…" is not "1."', () => {
    const markdown = '1994. The year it all began.';
    const book = request(markdown);
    const xhtml = readZip(epub(book)).text('OEBPS/chapter-1.xhtml');
    const word = readZip(docx(book));
    const page = printHtml(book);
    const numbered = (html: string) =>
      /start="1994"/u.test(html) || shownText(html).includes('1994');
    expect(numbered(xhtml)).toBe(true);
    expect(numbered(page)).toBe(true);
    expect(
      /w:startOverride w:val="1994"|w:start w:val="1994"/u.test(word.text('word/numbering.xml')) ||
        shownText(word.text('word/document.xml')).includes('1994'),
    ).toBe(true);
  });

  it('shows "&euro;" and "&eacute;" as the PDF does, € and é, in the EPUB and in Word', () => {
    const out = shown('It cost 5&euro; at the caf&eacute;.');
    expect(out.pdf).toContain('5€ at the café');
    expect(out.epub).toContain('5€ at the café');
    expect(out.word).toContain('5€ at the café');
  });
});

describe('a long note', () => {
  it('exports a long bracketed transcript about as fast as the word count reads it', () => {
    // The spec's own case (§4): one paragraph, a line per turn, "[laughs]" in each.
    const lines = Array.from(
      { length: 20_000 },
      (_, i) => `Speaker ${i}: words [laughs] and [pause] more`,
    );
    const markdown = lines.join('\n');
    const countStart = performance.now();
    countWords(markdown);
    const counting = performance.now() - countStart;
    const start = performance.now();
    epub(request(markdown));
    const exporting = performance.now() - start;
    // The window is frozen while it runs: seconds for what the count reads in a fraction of one.
    expect(exporting).toBeLessThan(Math.max(2_000, 10 * counting));
  }, 120_000);
});
