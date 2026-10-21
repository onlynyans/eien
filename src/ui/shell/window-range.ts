// Which rows of a long list to draw (./windowed-rows.ts): the ones in sight,
// and a few either side so a scroll or an arrow key never shows a gap. Rows
// are all one height, so it's arithmetic, not measuring each.

/** A list at least this long draws only the rows in sight; a shorter one draws them all. */
export const WINDOW_FROM = 200;

/** Rows drawn beyond those in sight, above and below. */
export const OVERSCAN = 15;

export interface Viewport {
  /** How far the scroller is scrolled, in pixels. */
  readonly scrollTop: number;
  /** How tall the scroller's view is. */
  readonly height: number;
  /** Where the list starts within the scroller's content. */
  readonly offset: number;
}

/** Rows `first` to `last`, `last` not included. */
export interface Range {
  readonly first: number;
  readonly last: number;
}

/**
 * The rows to draw of `count` rows each `rowHeight` tall, for the scroller's
 * `view`. Never empty while there are rows: a list scrolled out of sight
 * still draws a few at the nearer end, so a row can always take the keyboard.
 */
export function windowRange(count: number, rowHeight: number, view: Viewport): Range {
  if (count === 0) return { first: 0, last: 0 };
  const height = Math.max(rowHeight, 1);
  const top = view.scrollTop - view.offset;
  const firstSeen = Math.floor(top / height);
  const lastSeen = Math.ceil((top + view.height) / height);
  const first = Math.min(Math.max(firstSeen - OVERSCAN, 0), count - 1);
  const last = Math.max(Math.min(lastSeen + OVERSCAN, count), first + 1);
  return { first, last };
}

/** The scroll position that brings row `index` into sight, moving as little as it can. */
export function revealTop(index: number, rowHeight: number, view: Viewport): number {
  const rowTop = view.offset + index * rowHeight;
  const rowBottom = rowTop + rowHeight;
  if (rowTop < view.scrollTop) return rowTop;
  if (rowBottom > view.scrollTop + view.height) return rowBottom - view.height;
  return view.scrollTop;
}
