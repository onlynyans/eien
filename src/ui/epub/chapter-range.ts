// A run of a drawn chapter's words (#40, Phase 5): words chosen on the page
// as offsets in the chapter's words (core/epub/place.ts, the pieces a place
// counts, ./chapter-place.ts), and offsets back to the text they cover, for
// a highlight or a match. Only the book's own words count, so a boundary in
// a blank piece or in what Eien draws in the book's place (a break's marks)
// takes the next of the book's characters.

import type { Span } from '../../core/epub';
import { piecesOf } from './chapter-place';

/** The offset of the boundary (`node`, `at`) among the chapter's words: the next counted character's. */
export function offsetAt(chapter: HTMLElement, node: Node, at: number): number {
  const point = document.createRange();
  point.setStart(node, at);
  let offset = 0;
  for (const piece of piecesOf(chapter)) {
    if (piece === node) return offset + Math.min(at, piece.length);
    // The piece begins at or after the boundary: the boundary's words begin there.
    if (point.comparePoint(piece, 0) >= 0) return offset;
    offset += piece.length;
  }
  return offset;
}

/** The words `range` chooses in the chapter, as a span of its words; null for none of them. */
export function spanOf(chapter: HTMLElement, range: AbstractRange): Span | null {
  const from = offsetAt(chapter, range.startContainer, range.startOffset);
  const to = offsetAt(chapter, range.endContainer, range.endOffset);
  return to > from ? { from, to } : null;
}

/** Where a span's words are in the drawn chapter: the text nodes and offsets it runs between. */
export interface Bounds {
  readonly startContainer: Text;
  readonly startOffset: number;
  readonly endContainer: Text;
  readonly endOffset: number;
}

/** A drawn chapter's words, walked once: its pieces, and where each begins among its words. */
export interface Walked {
  readonly pieces: readonly Text[];
  /** Each piece's first offset, and one more: the chapter's length, last. */
  readonly starts: readonly number[];
}

/** The chapter's words walked, for the spans it shows (many, with one walk). */
export function walked(chapter: HTMLElement): Walked {
  const pieces = piecesOf(chapter);
  const starts = [0];
  for (const piece of pieces) starts.push((starts.at(-1) as number) + piece.length);
  return { pieces, starts };
}

/** The piece holding the character at `offset` (within the chapter's words), by halves. */
function pieceAt(starts: readonly number[], offset: number): number {
  let low = 0;
  let high = starts.length - 2;
  while (low < high) {
    const middle = (low + high + 1) >> 1;
    if ((starts[middle] as number) <= offset) low = middle;
    else high = middle - 1;
  }
  return low;
}

/**
 * Where `span`'s words are drawn in a chapter `walk` holds, clamped to its
 * words; null for none. It ends after its last character, never at the next
 * piece's start, so a span ending a paragraph never reaches what follows.
 */
export function boundsOf(walk: Walked, span: Span): Bounds | null {
  const { pieces, starts } = walk;
  // Clamped to the chapter's words: a span past them all (a chapter changed since) shows nothing.
  const to = Math.min(span.to, starts.at(-1) ?? 0);
  const from = Math.max(0, span.from);
  if (from >= to) return null;
  // Blank pieces aren't walked, so every piece is at least a character: the search lands in one.
  const first = pieceAt(starts, from);
  const last = pieceAt(starts, to - 1);
  const startContainer = pieces[first];
  const endContainer = pieces[last];
  if (!startContainer || !endContainer) return null;
  return {
    startContainer,
    startOffset: from - (starts[first] as number),
    endContainer,
    endOffset: to - (starts[last] as number),
  };
}

/** `bounds` as a live range, to choose on the page. */
export function rangeOver(bounds: Bounds): Range {
  const range = document.createRange();
  range.setStart(bounds.startContainer, bounds.startOffset);
  range.setEnd(bounds.endContainer, bounds.endOffset);
  return range;
}
