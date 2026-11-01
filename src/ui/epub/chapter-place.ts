// Where a reader is in a drawn chapter (#40, Phase 2), measured in the
// window: the first line in sight, as an offset in the chapter's words
// (core/epub/place.ts), and the way back to it. Only the book's own words
// count: not the space between blocks, nor what Eien draws in their place (a
// scene break's marks, a picture's words when it can't be shown), so the
// same offset is the same words on any device. A chapter reads top to
// bottom, so both look for the line by halves: a long chapter costs a few
// dozen measures, never one per word.

import { BLOCK_NAMES, offsetOf, spotOf } from '../../core/epub';
import { FRONT } from './front-matter';

/** A piece of the page's box, measured: the window's own, or a test's. */
export type RectOf = (range: Range) => Pick<DOMRect, 'top' | 'bottom'>;

const measured: RectOf = (range) => range.getBoundingClientRect();

/** What Eien draws in the book's place, not the book's words: a break's marks, a picture's words, its front matter (./front-matter.ts). */
export const OWN = `.scene-break, .image-words, ${FRONT}`;

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
 * The offset of the first word whose box ends past `edge`, by `end` (its
 * bottom, or its right): 0 at the chapter's start, and for a chapter with no
 * words; every word's length for a chapter read to its end.
 */
function firstPast(chapter: HTMLElement, edge: number, end: (range: Range) => number): number {
  const pieces = piecesOf(chapter);
  const lengths = pieces.map((text) => text.length);
  const endOf = (i: number) => {
    const piece = pieces[i] as Text;
    return end(rangeOver(piece, 0, piece.length));
  };
  const at = firstBelow(pieces.length, endOf, edge);
  const piece = pieces[at];
  if (!piece) return lengths.reduce((sum, length) => sum + length, 0);
  const within = firstBelow(piece.length, (i) => end(rangeOver(piece, i, i + 1)), edge);
  return offsetOf(lengths, { index: at, within: Math.min(within, piece.length - 1) });
}

/**
 * The offset of the first line in sight under `top` (the scroller's top, in
 * the window's coordinates): the first word whose line ends below it.
 * 0 at the chapter's top, and for a chapter with no words.
 */
export const firstInSight = (chapter: HTMLElement, top: number, rectOf = measured): number =>
  firstPast(chapter, top, (range) => rectOf(range).bottom);

/** A piece of the page's box across, measured: the window's own, or a test's. */
export type SideOf = (range: Range) => Pick<DOMRect, 'left' | 'right'>;

/**
 * A range's box across, as the window lays it out. A character just after the point a word was
 * hyphenated at (Set as a book) stands at the next line's start, but its range holds the inserted
 * hyphen too, at the end of the line before (Chromium's): on the page before, which a place would
 * open a page early at. A character's own box is its range's last.
 */
export const across: SideOf = (range) => {
  const one =
    range.startContainer === range.endContainer && range.endOffset - range.startOffset === 1;
  const own = one ? [...range.getClientRects()].at(-1) : undefined;
  return own ?? range.getBoundingClientRect();
};

/**
 * In pages (Phase 3b), the offset of the first word on the page whose left
 * edge is `left` (the window's coordinates): the first whose box ends right
 * of it, as columns read left to right.
 */
export const firstOnPage = (chapter: HTMLElement, left: number, sideOf = across): number =>
  firstPast(chapter, left, (range) => sideOf(range).right);

/** The character at `offset` among the chapter's words, as a range; null for a chapter with none. */
export function characterAt(chapter: HTMLElement, offset: number): Range | null {
  const pieces = piecesOf(chapter);
  const spot = spotOf(
    pieces.map((text) => text.length),
    offset,
  );
  const piece = spot && pieces[spot.index];
  if (!spot || !piece) return null;
  const within = Math.min(spot.within, piece.length - 1);
  return rangeOver(piece, within, within + 1);
}

/** `scroller` moved so the line holding `offset` stands at its top; at the chapter's top for 0. */
export function showOffset(
  chapter: HTMLElement,
  scroller: HTMLElement,
  offset: number,
  rectOf = measured,
): void {
  const character = offset > 0 ? characterAt(chapter, offset) : null;
  if (!character) {
    scroller.scrollTop = 0;
    return;
  }
  scroller.scrollTop += rectOf(character).top - scroller.getBoundingClientRect().top;
}

/** The offset of the first of the chapter's words after `node`: where a place named there starts. */
export function offsetAfter(chapter: HTMLElement, node: Node): number {
  let offset = 0;
  for (const piece of piecesOf(chapter)) {
    if (node.compareDocumentPosition(piece) & Node.DOCUMENT_POSITION_FOLLOWING) return offset;
    offset += piece.length;
  }
  return offset;
}

/** What a word's block is: words in two of them read with a space between (core's one list). */
const BLOCK = BLOCK_NAMES.join(', ');

/**
 * The words of `pieces` from piece `index`, `within` it, on, a space between
 * those of two blocks, as they read: of each piece, what `take` takes (given
 * its offset in the chapter and the words so far), until it takes none.
 */
function joined(
  pieces: readonly Text[],
  index: number,
  within: number,
  take: (piece: Text, at: number, words: string) => string | null,
): string {
  let words = '';
  let block: Element | null = null;
  let at = 0;
  for (let i = 0; i < index; i++) at += (pieces[i] as Text).length;
  for (let i = index; i < pieces.length; i++) {
    const piece = pieces[i] as Text;
    const part = take(piece, at, words);
    at += piece.length;
    if (part === null) break;
    const own = piece.parentElement?.closest(BLOCK) ?? null;
    if (words !== '' && own !== block) words += ' ';
    block = own;
    words += i === index ? part.slice(within) : part;
  }
  return words;
}

/**
 * About `length` of the chapter's words from `offset` on (a bookmark's page's
 * first words, Phase 4b), a space between those of two blocks, as they read.
 */
export function wordsFrom(chapter: HTMLElement, offset: number, length: number): string {
  const pieces = piecesOf(chapter);
  const spot = spotOf(
    pieces.map((text) => text.length),
    offset,
  );
  if (!spot) return '';
  // A page that begins inside a hyphenated word (Set as a book) begins with its start.
  const first = pieces[spot.index] as Text;
  let within = spot.within;
  while (within > 0 && /[\p{L}\p{N}]/u.test(first.data[within - 1] ?? '')) within--;
  return joined(pieces, spot.index, within, (piece, _at, words) =>
    words.length < length ? piece.data : null,
  ).slice(0, length);
}

/**
 * The chapter's words from `from` to `to` (a highlight's, Phase 5a), a space
 * between those of two blocks, at most `max` of them (a long one's start).
 */
export function wordsBetween(chapter: HTMLElement, from: number, to: number, max: number): string {
  const pieces = piecesOf(chapter);
  const spot = spotOf(
    pieces.map((text) => text.length),
    from,
  );
  if (!spot || to <= from) return '';
  return joined(pieces, spot.index, spot.within, (piece, at, words) =>
    at >= to || words.length >= max ? null : piece.data.slice(0, to - at),
  ).slice(0, max);
}
