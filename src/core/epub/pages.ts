// A chapter in pages (#40, Phase 3b): the arithmetic of laying it in
// columns as tall as the page, each a page. A page ends on a whole line, so
// no line is cut; the pages are counted from how wide the columns run; and
// the book's fore-edge shows how far through, in sixths, before any number.

/** The page's height in whole lines: the most that fit in `room`, at least one. */
export const wholeLines = (room: number, line: number): number =>
  line > 0 ? Math.max(line, Math.floor(room / line) * line) : room;

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
