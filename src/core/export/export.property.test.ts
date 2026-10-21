// Properties of the exports over generated notes: whatever a note holds
// (marks, HTML, references, footnotes, characters XML can't), every part of
// its EPUB and its Word file is well-formed XML, and each word of the note
// is in each, its footnotes' words too (as the word count reads the note).

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { shownText, xmlParts } from '../../../tests/support/export-parts';
import { readZip } from '../../../tests/support/read-zip';
import { assertSoundXhtml, assertWellFormedXml } from '../../../tests/support/xml-check';
import { readMarkdown } from '../markdown';
import { frontMatterEnd } from '../text';
import type { ExportRequest } from './book';
import { docx } from './docx';
import { epub } from './epub';
import { printHtml } from './print-html';

/** The words a check looks for: none of them a mark, a label or part of one. */
const WORDS = ['scarf', 'needle', 'mended', 'ember', 'thread'];

const token = fc.constantFrom(
  ...WORDS,
  '*',
  '**',
  '_',
  '~~',
  '^',
  '==',
  '`',
  '[',
  ']',
  '(',
  ')',
  '[^1]',
  '[^a]',
  '[^none]',
  '<u>',
  '</u>',
  '<big>',
  '<em>',
  '</p>',
  '<br>',
  '&',
  '&nbsp;',
  '&bogus;',
  '&#1;',
  '&#x0F0001;',
  '\\',
  '"',
  "'",
  '#',
  '>',
  '|',
  '\u0001',
  '\u000b',
  '\ud800',
  '￾',
  '😀',
  '[link](https://example.com/?a=1&b=2)',
  '![alt](x.png)',
  '[[Wiki]]',
  '[[Wiki|alias]]',
  '[[Wiki[^1]]]',
  '[the link[^a]](https://example.org)',
  'www.example.com',
  '&D;',
  '&euro;',
  '&#12345678;',
  '<?',
  '<!--',
);
const line = fc
  .array(fc.tuple(token, fc.constantFrom(' ', '', '\t')), { minLength: 1, maxLength: 8 })
  .map((parts) =>
    parts
      .map(([t, space]) => t + space)
      .join('')
      .trim(),
  )
  .filter((l) => l !== '');
const block = fc.oneof(
  fc.array(line, { minLength: 1, maxLength: 3 }).map((lines) => lines.join('\n')),
  line.map((l) => `# ${l}`),
  line.map((l) => `### ${l}`),
  line.map((l) => `> ${l}`),
  fc.constant('***'),
  line.map((l) => `- ${l}`),
  line.map((l) => `1. ${l}\n   - ${l}`),
  line.map((l) => `1994. ${l}\n1995. ${l}`),
  line.map((l) => `<? ${l}`),
  line.map((l) => `| ${l} | b |\n|---|---|\n| c |`),
  line.map((l) => `\`\`\`\n${l}\n\`\`\``),
  line.map((l) => `<div>${l}</div>`),
  line.map((l) => `[^1]: ${l}`),
  line.map((l) => `[^a]: ${l}\n    ${l}`),
  line.map((l) => `[^1]: ~~~ ${l}`),
  line.map((l) => `[^a]: <!-- ${l}`),
);
const note = fc
  .tuple(fc.boolean(), fc.array(block, { minLength: 1, maxLength: 6 }))
  .map(([front, blocks]) => (front ? '---\nid: X1\n---\n' : '') + blocks.join('\n\n'));

const request = (markdowns: string[]): ExportRequest => ({
  title: 'Book & <Title>',
  notes: markdowns.map((markdown, i) => ({ title: `Chapter ${i + 1}`, markdown })),
  book: true,
  quotes: 'curly',
  language: 'en-US',
  key: 'k',
  date: new Date(0),
});

/** The note's words as Eien counts them: a code fence's language, a link's address, aren't words. */
const wordsIn = (markdowns: string[]) =>
  markdowns
    .map((markdown) => readMarkdown(markdown.slice(frontMatterEnd(markdown))).plain)
    .join(' ');

/** How many times each checked word is in `text`. */
const counted = (text: string) => WORDS.map((word) => text.toLowerCase().split(word).length - 1);

describe('exports, over generated notes', () => {
  it('EPUB: every part well-formed, every word there', () => {
    fc.assert(
      fc.property(fc.array(note, { minLength: 1, maxLength: 3 }), (markdowns) => {
        const zip = epub(request(markdowns));
        let shown = '';
        for (const [name, xml] of xmlParts(zip)) {
          if (/\.xhtml$/u.test(name)) assertSoundXhtml(xml);
          else assertWellFormedXml(xml);
          if (/chapter-\d+\.xhtml$/u.test(name)) shown += ` ${shownText(xml)}`;
        }
        const words = counted(wordsIn(markdowns));
        counted(shown).forEach((n, i) => {
          expect(n).toBeGreaterThanOrEqual(Math.min(words[i] as number, 1));
        });
      }),
    );
  });

  it('Word: every part well-formed, every word there, every footnote mark a footnote', () => {
    fc.assert(
      fc.property(fc.array(note, { minLength: 1, maxLength: 3 }), (markdowns) => {
        const zip = docx(request(markdowns));
        for (const [, xml] of xmlParts(zip)) assertWellFormedXml(xml);
        const read = readZip(zip);
        const document = read.text('word/document.xml');
        const footnotes = read.text('word/footnotes.xml');
        const shown = `${shownText(document)} ${shownText(footnotes)}`;
        const words = counted(wordsIn(markdowns));
        counted(shown).forEach((n, i) => {
          expect(n).toBeGreaterThanOrEqual(Math.min(words[i] as number, 1));
        });
        const marks = [...document.matchAll(/<w:footnoteReference w:id="(\d+)"\/>/gu)].map(
          (m) => m[1],
        );
        const notes = [...footnotes.matchAll(/<w:footnote w:id="(\d+)">/gu)].map((m) => m[1]);
        expect(marks).toEqual(notes); // one mark each, in order
        expect(footnotes).not.toContain('w:footnoteReference');
      }),
    );
  });

  it('the PDF’s page: no script, and only its own styles', () => {
    fc.assert(
      fc.property(fc.array(note, { minLength: 1, maxLength: 2 }), (markdowns) => {
        const html = printHtml(request(markdowns));
        expect(html).not.toMatch(/<(?:script|img|iframe|object|embed|link|style(?! *>))\b/iu);
        expect(html.match(/<style>/gu)).toHaveLength(1);
      }),
    );
  });
});
