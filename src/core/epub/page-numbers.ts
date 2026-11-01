// A place's page number (#40, Phase 4): the printed edition's, where the
// book has a page-list (./contents.ts printPagesOf), for citing; else a
// steady page, 1,500 characters of the book, which never moves with the
// window, the face or the device. Steady pages run over every spine item in
// order (a printed book prints its notes too), counted as a place counts
// words (./chapter-count.ts), so they only ever rise through the book.

/** A steady page's length, in the characters a place counts. */
export const STEADY_CHARS = 1500;

/** Each spine item's length, null until it's counted. */
export type Lengths = readonly (number | null)[];

/** The book's steady pages, at least one; null until every item is counted. */
export function steadyPages(lengths: Lengths): number | null {
  let total = 0;
  for (const length of lengths) {
    if (length === null) return null;
    total += Math.max(0, length);
  }
  return Math.max(1, Math.ceil(total / STEADY_CHARS));
}

/**
 * The steady page `offset` into spine item `spine` falls on, 1 first and
 * never past the last; null until the book is counted. A place past its
 * item's end (the window and the count disagreeing) stands at its end.
 */
export function steadyAt(lengths: Lengths, spine: number, offset: number): number | null {
  const pages = steadyPages(lengths);
  if (pages === null || spine < 0 || spine >= lengths.length) return null;
  let before = 0;
  for (let i = 0; i < spine; i++) before += Math.max(0, lengths[i] ?? 0);
  const within = Math.min(Math.max(0, Math.floor(offset) || 0), Math.max(0, lengths[spine] ?? 0));
  return Math.min(pages, Math.floor((before + within) / STEADY_CHARS) + 1);
}

/** Where steady page `page` begins: its spine item and the offset in it; null until counted, or past the book. */
export function steadyStart(
  lengths: Lengths,
  page: number,
): { readonly spine: number; readonly offset: number } | null {
  const pages = steadyPages(lengths);
  if (pages === null || !Number.isInteger(page) || page < 1 || page > pages) return null;
  let rest = (page - 1) * STEADY_CHARS;
  for (let spine = 0; spine < lengths.length; spine++) {
    const length = Math.max(0, lengths[spine] ?? 0);
    if (rest < length) return { spine, offset: rest };
    rest -= length;
  }
  // The book's one page, of no words at all.
  return { spine: 0, offset: 0 };
}

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

/** A place's page and the book's pages: the printed edition's where there's a page-list, else steady ones. */
export function pageOf(
  count: PageCount,
  spine: number,
  offset: number,
): { readonly label: string | number | null; readonly of: number | null } {
  if (count.print.length > 0)
    return { label: printAt(count.print, spine, offset), of: printPages(count.print) };
  return { label: steadyAt(count.lengths, spine, offset), of: steadyPages(count.lengths) };
}
