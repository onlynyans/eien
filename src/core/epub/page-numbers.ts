// A place's page number (#40, Phase 4; #67): the printed edition's, where
// the book has a page-list (./contents.ts printPagesOf): real, citable, the
// same on every screen. A book without one is numbered by its chapter's
// pages as laid out now (the window's, ui/epub/book-place.ts), which no
// place elsewhere in the book has: a list's row or the edge's strip names
// such a place by how far through the book it is, by its chapter's words
// as counted (./chapter-count.ts), never moving with the window, the face
// or the device.

import { bookFraction, percent, type Sized } from './progress';

/** Each spine item's length, in the characters a place counts; null until it's counted. */
export type Lengths = readonly (number | null)[];

/** A printed page: its label, the spine item it's in, and where in it (null: not found there, or not yet counted). */
export interface PrintAt {
  readonly label: string;
  readonly spine: number;
  readonly offset: number | null;
}

/**
 * The printed page a place is on: the last to begin at or before it in its
 * own item (the later of two at one place), else the last of the items
 * before it, which needs no count: their order says it. Null before the
 * first printed page (a cover, say). A page whose place its own item lost
 * counts for nothing there.
 */
export function printAt(pages: readonly PrintAt[], spine: number, offset: number): string | null {
  let here: { label: string; at: number } | null = null;
  let before: { label: string; spine: number } | null = null;
  for (const page of pages) {
    if (page.spine === spine && page.offset !== null && page.offset <= offset) {
      if (!here || page.offset >= here.at) here = { label: page.label, at: page.offset };
    } else if (page.spine < spine && (!before || page.spine >= before.spine)) {
      before = { label: page.label, spine: page.spine };
    }
  }
  return here?.label ?? before?.label ?? null;
}

/** How many printed pages, as the colophon says it: the last's label where it's a number, else none. */
export function printPages(pages: readonly PrintAt[]): number | null {
  const last = pages.at(-1)?.label ?? '';
  return /^\d+$/u.test(last) ? Number(last) : null;
}

/** A count with its thousands set apart, as a printed book's are: 2,450. */
const grouped = (count: number) => String(count).replace(/\B(?=(\d{3})+(?!\d))/gu, ',');

/** What the colophon says of a page: "page 212 of 2,450", "page xii", or nothing. */
export function pageWords(label: string | number | null, of: number | null): string {
  if (label === null) return '';
  const page = typeof label === 'number' ? grouped(label) : label;
  return of === null ? `page ${page}` : `page ${page} of ${grouped(of)}`;
}

/**
 * What the colophon says of a spread (Phase 3d): "pages 212–213 of 2,450";
 * one page's words where the recto's page is the verso's, or none is known.
 */
export function spreadWords(
  verso: string | number | null,
  recto: string | number | null,
  of: number | null,
): string {
  if (verso === null || recto === null || String(recto) === String(verso))
    return pageWords(verso, of);
  const page = (label: string | number) => (typeof label === 'number' ? grouped(label) : label);
  const pages = `pages ${page(verso)}–${page(recto)}`;
  return of === null ? pages : `${pages} of ${grouped(of)}`;
}

/** What a book's pages are counted from: its items' lengths, and its printed pages where it has them. */
export interface PageCount {
  readonly lengths: Lengths;
  readonly print: readonly PrintAt[];
}

/**
 * How far through the book (0 to 1) `offset` into spine item `index` is, by
 * that item's words as counted and the chapters' sizes, as the colophon's
 * percent is (./progress.ts); null until the item is counted.
 */
export function shareAt(
  spine: readonly Sized[],
  lengths: Lengths,
  index: number,
  offset: number,
): number | null {
  const length = lengths[index];
  if (length === null || length === undefined) return null;
  return bookFraction(spine, index, length > 0 ? offset / length : 0);
}

/**
 * A place as a row names it (a mark's, a match's): its printed page's label
 * ("212", "xii"), else how far through the book ("21%"); null for none
 * known yet (its chapter not counted, or before a printed book's first page).
 */
export function placeLabel(
  count: PageCount,
  spine: readonly Sized[],
  index: number,
  offset: number,
): string | null {
  // A printed page there isn't known until its chapter is counted: the one before would be wrong.
  if (count.print.length > 0)
    return count.lengths[index] === null ? null : printAt(count.print, index, offset);
  const share = shareAt(spine, count.lengths, index, offset);
  return share === null ? null : percent(share);
}

/** A place as the edge's strip says it: "page 212 of 2,450", else "21% of the book"; '' for none known yet. */
export function placeWords(
  count: PageCount,
  spine: readonly Sized[],
  index: number,
  offset: number,
): string {
  if (count.print.length > 0) {
    const label = placeLabel(count, spine, index, offset);
    return label === null ? '' : pageWords(label, printPages(count.print));
  }
  const share = shareAt(spine, count.lengths, index, offset);
  return share === null ? '' : bookWords(share);
}

/** How far through the book, as the colophon and the strip say it: "21% of the book". */
export const bookWords = (share: number): string => `${percent(share)} of the book`;

/** How far through the chapter, as the colophon says it scrolling, where there are no pages: "40% of the chapter". */
export const chapterWords = (fraction: number): string => `${percent(fraction)} of the chapter`;
