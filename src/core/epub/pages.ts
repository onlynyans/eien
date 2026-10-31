// A chapter in pages (#40, Phase 3b): the arithmetic of laying it in
// columns as tall as the page, each a page. A page ends on a whole line, so
// no line is cut; the pages are counted from how wide the columns run; and
// the book's fore-edge shows how far through, in sixths, before any number.
// With room, two pages face each other (Phase 3d, the spread): a sight is
// the pages shown at once, one or two.

/** The page's height in whole lines: the most that fit in `room`, at least one. */
export const wholeLines = (room: number, line: number): number =>
  line > 0 ? Math.max(line, Math.floor(room / line) * line) : room;

/** A page in a spread is at least this many of the text's ems (epub.md, Decided → Paged). */
export const SPREAD_PAGE_EM = 20;

/**
 * Whether `room` (the pane's width, in the sheet's own pixels) holds two
 * pages of at least 20em of the text's size `em`, with the sheet's side
 * margins `padX` each side and the gutter `gap` between them.
 */
export const spreadFits = (room: number, em: number, padX: number, gap: number): boolean =>
  em > 0 && (room - 2 * padX - gap) / 2 >= SPREAD_PAGE_EM * em;

/** How many sights `columns` pages make, `per` (one or two) shown at once: at least one. */
export const sightsIn = (columns: number, per: number): number =>
  Math.max(1, Math.ceil(columns / Math.max(1, per)));

/**
 * What a page is to its chapter: Eien's own front matter before the book's
 * first chapter (Set as a book's title page and imprint), the chapter's
 * opening, one of its pages, or none (a spread's recto past the last page).
 */
export type PageRole = 'front' | 'opening' | 'text' | 'blank';

/** The roles of the pages in sight `sight`, `per` at a time, of `columns` pages, the first `front` front matter. */
export function pageRoles(sight: number, per: number, front: number, columns: number): PageRole[] {
  return Array.from({ length: per }, (_, i) => {
    const page = sight * per + i;
    if (page >= columns) return 'blank';
    if (page < front) return 'front';
    return page === front ? 'opening' : 'text';
  });
}

/** The sight a chapter opens at, past its front matter: where its first word is, and where Home goes. */
export const openingSight = (front: number, per: number): number =>
  Math.floor(front / Math.max(1, per));

/** How far through its own pages sight `sight` of `sights` is, 0 to 1: the front matter is none of them. */
export function throughSights(sight: number, sights: number, opening: number): number {
  const last = sights - 1 - opening;
  return last > 0 ? Math.min(1, Math.max(0, (sight - opening) / last)) : 1;
}

/** How many pages `width` of columns makes, each `page` wide with `gap` between: at least one. */
export const pagesIn = (width: number, page: number, gap: number): number =>
  page > 0 ? Math.max(1, Math.round((width + gap) / (page + gap))) : 1;

/**
 * A word measured this little short of its column (of a page's step) is in it: a rect rounded
 * down a hair, at a zoom, never puts a page's first word on the page before.
 */
const ROUNDING = 0.02;

/** The page a word `left` from the chapter's start falls on, among `pages` each `step` apart. */
export const pageAt = (left: number, step: number, pages: number): number =>
  step > 0 ? Math.min(pages - 1, Math.max(0, Math.floor(left / step + ROUNDING))) : 0;

/** The most edges the fore-edge shows each side. */
export const EDGES = 6;

/**
 * The fore-edge's paper edges, `through` (0 to 1) the book: the pages read
 * (`before`) or still to read, in sixths, at least one while any are.
 */
export function edgesOf(through: number, before: boolean): number {
  const share = before ? through : 1 - through;
  if (!(share > 0)) return 0;
  return Math.max(1, Math.min(EDGES, Math.round(share * EDGES)));
}
