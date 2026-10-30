// A chapter's lines as the DOM tests lay them out (#40, Phase 2; happy-dom
// lays out nothing): every one of its words on lines of ten characters, each
// line 20px, under a scroller whose top is the window's.

import { piecesOf, type RectOf } from './chapter-place';

export const LINE = 20;
const PER_LINE = 10;

/** Each character's line, by where it stands among `chapter`'s words, `scroller` scrolled as it is. */
export const linesOf =
  (chapter: HTMLElement, scroller: { readonly scrollTop: number }): RectOf =>
  (range) => {
    let at = 0;
    for (const piece of piecesOf(chapter)) {
      if (piece === range.startContainer) break;
      at += piece.length;
    }
    const line = (offset: number) => Math.floor(offset / PER_LINE) * LINE - scroller.scrollTop;
    const last = at + Math.max(range.startOffset, range.endOffset - 1);
    return { top: line(at + range.startOffset), bottom: line(last) + LINE };
  };
