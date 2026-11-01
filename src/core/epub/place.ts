// Where a reader is in a chapter (#40, Phase 2): an offset in its words,
// counted over the drawn chapter's text in the order it reads. Words, not a
// scroll position, so the place holds through a new width, text size,
// typeface or scroll style, and later a page (Phase 3). The window measures
// which text is in sight (ui/epub/chapter-place.ts); this is the arithmetic
// between an offset and the piece of text it falls in.

/** A character in one of the chapter's pieces of text: the piece, and how far into it. */
export interface Spot {
  readonly index: number;
  readonly within: number;
}

/**
 * Where `offset` falls among pieces of text `lengths` long: the piece that
 * holds it and how far in, clamped to the words there are; null for none.
 * An offset at a piece's end is the next one's start, so the place reads on.
 */
export function spotOf(lengths: readonly number[], offset: number): Spot | null {
  let rest = Math.max(0, Math.floor(Number.isFinite(offset) ? offset : 0));
  let last: Spot | null = null;
  for (let index = 0; index < lengths.length; index++) {
    const length = Math.max(0, lengths[index] ?? 0);
    if (length === 0) continue;
    if (rest < length) return { index, within: rest };
    rest -= length;
    last = { index, within: length };
  }
  return last;
}

/** The offset of `spot` among pieces of text `lengths` long. */
export function offsetOf(lengths: readonly number[], spot: Spot): number {
  let offset = 0;
  for (let index = 0; index < spot.index && index < lengths.length; index++) {
    offset += Math.max(0, lengths[index] ?? 0);
  }
  return offset + spot.within;
}

/**
 * Where the words in sight end, from `from` up to (not at) `to`: a page of no
 * words (a picture's) holds the place it stands at, its own word.
 */
export const sightEnd = (from: number, to: number): number => Math.max(to, from + 1);
