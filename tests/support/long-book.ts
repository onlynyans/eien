// A long book for the budgets (#40): chapters of many paragraphs, each its
// own file, and, if asked, one far larger chapter among them, as a book in
// one file would be. Made by hand, as the zip writer's books are small.

import { handEpub, nav, opf, page, XHTML } from './epub-parts';

/** One paragraph of the long book: 132 characters as a place counts them. */
export const LONG_PARAGRAPH = (n: number) =>
  `<p>Paragraph ${n}: it is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.</p>`;

export interface LongBook {
  /** How many chapters, each `paragraphs` long. */
  readonly chapters: number;
  readonly paragraphs: number;
  /** One more chapter, at the book's end, of this many paragraphs: never drawn by a test, only counted. */
  readonly large?: number;
}

/** The long book `of` asks for, its chapters named "Chapter 1" on. */
export function longBook(of: LongBook): Uint8Array {
  const words = (count: number) =>
    Array.from({ length: count }, (_, n) => LONG_PARAGRAPH(n)).join('\n');
  const sizes = [
    ...Array.from({ length: of.chapters }, () => of.paragraphs),
    ...(of.large ? [of.large] : []),
  ];
  const ids = sizes.map((_, n) => `c${n}`);
  const body = words(of.paragraphs);
  return handEpub('content.opf', [
    {
      name: 'content.opf',
      data: opf(
        '3.0',
        [
          { id: 'nav', href: 'nav.xhtml', type: XHTML, properties: 'nav' },
          ...ids.map((id) => ({ id, href: `${id}.xhtml`, type: XHTML })),
        ],
        ids,
      ),
    },
    { name: 'nav.xhtml', data: nav(ids.map((id, n) => [`Chapter ${n + 1}`, `${id}.xhtml`])) },
    ...ids.map((id, n) => ({
      name: `${id}.xhtml`,
      data: page(
        `Chapter ${n + 1}`,
        `<h1>Chapter ${n + 1}</h1>\n${sizes[n] === of.paragraphs ? body : words(sizes[n] ?? 0)}`,
      ),
    })),
  ]);
}
