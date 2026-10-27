// Which rows of a long list to draw (./windowed-rows.ts): the ones in sight,
// and a few either side so a scroll or an arrow key never shows a gap. Rows
// are one height, or (a list with groups' heads, backlog #42) one of two, so
// it's arithmetic, not measuring each.

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

/** Where a list's rows lie: `count` rows, each from `top(i)` to `top(i + 1)`. */
export interface RowSizes {
  readonly count: number;
  top(index: number): number;
  /** The row `y` falls in: the last one starting at or above it. */
  firstAt(y: number): number;
  /** How many rows start above `y`. */
  endAt(y: number): number;
}

/** Rows all `height` tall. */
export function evenRows(count: number, height: number): RowSizes {
  const each = Math.max(height, 1);
  return {
    count,
    top: (index) => index * each,
    firstAt: (y) => Math.floor(y / each),
    endAt: (y) => Math.ceil(y / each),
  };
}

/** Rows of the heights given, found by halving. */
export function mixedRows(heights: readonly number[]): RowSizes {
  const tops = [0];
  for (const height of heights) tops.push((tops.at(-1) ?? 0) + Math.max(height, 1));
  /** The first row starting at or below `y` (`count` past the end). */
  const from = (y: number) => {
    let low = 0;
    let high = heights.length;
    while (low < high) {
      const mid = (low + high) >> 1;
      if ((tops[mid] ?? 0) < y) low = mid + 1;
      else high = mid;
    }
    return low;
  };
  return {
    count: heights.length,
    top: (index) => tops[Math.min(Math.max(index, 0), heights.length)] ?? 0,
    firstAt: (y) => {
      const at = from(y);
      return (tops[at] ?? Number.POSITIVE_INFINITY) === y ? at : at - 1;
    },
    endAt: from,
  };
}

/**
 * The rows to draw for the scroller's `view`. Never empty while there are
 * rows: a list scrolled out of sight still draws a few at the nearer end, so
 * a row can always take the keyboard.
 */
export function windowRange(rows: RowSizes, view: Viewport): Range {
  const { count } = rows;
  if (count === 0) return { first: 0, last: 0 };
  const top = view.scrollTop - view.offset;
  const firstSeen = rows.firstAt(top);
  const lastSeen = rows.endAt(top + view.height);
  const first = Math.min(Math.max(firstSeen - OVERSCAN, 0), count - 1);
  const last = Math.max(Math.min(lastSeen + OVERSCAN, count), first + 1);
  return { first, last };
}

/** The scroll position that brings row `index` into sight, moving as little as it can. */
export function revealTop(rows: RowSizes, index: number, view: Viewport): number {
  const rowTop = view.offset + rows.top(index);
  const rowBottom = view.offset + rows.top(index + 1);
  if (rowTop < view.scrollTop) return rowTop;
  if (rowBottom > view.scrollTop + view.height) return rowBottom - view.height;
  return view.scrollTop;
}
