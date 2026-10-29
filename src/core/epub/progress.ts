// How far through a chapter and a book (#40, Phase 2), as the colophon says
// it. A chapter by how far it's scrolled; the book by its chapters' sizes in
// the zip (free to know, and near enough to their words), the chapters out
// of the reading order (non-linear: a note, an answer) not counted.

/** How far a scroller `top` of `height` with `shown` in sight has come: 0 to 1, all of it in sight being the end. */
export function chapterFraction(top: number, height: number, shown: number): number {
  const room = height - shown;
  if (!(room > 0)) return 1;
  return Math.min(1, Math.max(0, top / room));
}

export interface Sized {
  readonly linear: boolean;
  /** Its size in bytes, inflated. */
  readonly size: number;
}

/**
 * How far through the book: the chapters before `index`, and `within` (0 to
 * 1) of it. A chapter out of the reading order stands where it falls.
 */
export function bookFraction(spine: readonly Sized[], index: number, within: number): number {
  let total = 0;
  let before = 0;
  spine.forEach((item, at) => {
    if (!item.linear) return;
    const size = Math.max(0, item.size);
    total += size;
    if (at < index) before += size;
    else if (at === index) before += size * Math.min(1, Math.max(0, within));
  });
  return total > 0 ? Math.min(1, before / total) : 0;
}

/** A fraction as the colophon says it: whole percent, rounded down, so 100% is only the end. */
export const percent = (fraction: number): string =>
  `${Math.floor(Math.min(1, Math.max(0, fraction)) * 100 + 1e-9)}%`;
