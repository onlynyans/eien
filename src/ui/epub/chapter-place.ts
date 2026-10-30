// Where a reader is in a drawn chapter (#40, Phase 2), measured in the
// window: the first line in sight, as an offset in the chapter's words
// (core/epub/place.ts), and the way back to it. Only the book's own words
// count: not the space between blocks, nor what Eien draws in their place (a
// scene break's marks, a picture's words when it can't be shown), so the
// same offset is the same words on any device. A chapter reads top to
// bottom, so both look for the line by halves: a long chapter costs a few
// dozen measures, never one per word.

import { offsetOf, spotOf } from '../../core/epub';

/** A piece of the page's box, measured: the window's own, or a test's. */
export type RectOf = (range: Range) => Pick<DOMRect, 'top' | 'bottom'>;

const measured: RectOf = (range) => range.getBoundingClientRect();

/** What Eien draws in the book's place, not the book's words. */
const OWN = '.scene-break, .image-words';

/** The chapter's words, piece by piece, in the order they read. */
export function piecesOf(chapter: HTMLElement): Text[] {
  const pieces: Text[] = [];
  const walker = document.createTreeWalker(chapter, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node as Text;
    if (text.data.trim() === '' || text.parentElement?.closest(OWN)) continue;
    pieces.push(text);
  }
  return pieces;
}

const rangeOver = (text: Text, from: number, to: number): Range => {
  const range = document.createRange();
  range.setStart(text, from);
  range.setEnd(text, to);
  return range;
};

/** The first of `count` things whose box ends below `top`, by halves; `count` for none. */
function firstBelow(count: number, bottomOf: (at: number) => number, top: number): number {
  let low = 0;
  let high = count;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (bottomOf(middle) > top) high = middle;
    else low = middle + 1;
  }
  return low;
}

/**
 * The offset of the first line in sight under `top` (the scroller's top, in
 * the window's coordinates): the first word whose line ends below it.
 * 0 at the chapter's top, and for a chapter with no words.
 */
export function firstInSight(chapter: HTMLElement, top: number, rectOf = measured): number {
  const pieces = piecesOf(chapter);
  const lengths = pieces.map((text) => text.length);
  const bottomOf = (i: number) => {
    const piece = pieces[i] as Text;
    return rectOf(rangeOver(piece, 0, piece.length)).bottom;
  };
  const at = firstBelow(pieces.length, bottomOf, top);
  const piece = pieces[at];
  // Every word above the top: the chapter read to its end.
  if (!piece) return lengths.reduce((sum, length) => sum + length, 0);
  const within = firstBelow(piece.length, (i) => rectOf(rangeOver(piece, i, i + 1)).bottom, top);
  return offsetOf(lengths, { index: at, within: Math.min(within, piece.length - 1) });
}

/** `scroller` moved so the line holding `offset` stands at its top; at the chapter's top for 0. */
export function showOffset(
  chapter: HTMLElement,
  scroller: HTMLElement,
  offset: number,
  rectOf = measured,
): void {
  const pieces = offset > 0 ? piecesOf(chapter) : [];
  const spot = spotOf(
    pieces.map((text) => text.length),
    offset,
  );
  const piece = spot && pieces[spot.index];
  if (!spot || !piece) {
    scroller.scrollTop = 0;
    return;
  }
  const within = Math.min(spot.within, piece.length - 1);
  const line = rectOf(rangeOver(piece, within, within + 1)).top;
  scroller.scrollTop += line - scroller.getBoundingClientRect().top;
}
