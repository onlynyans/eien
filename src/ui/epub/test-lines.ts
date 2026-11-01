// A chapter's lines as the DOM tests lay them out (#40, Phase 2; happy-dom
// lays out nothing): every one of its words on lines of ten characters, each
// line 20px, under a scroller whose top is the window's; and a book's page laid out so.

import { vi } from 'vitest';
import { piecesOf, type RectOf } from './chapter-place';
import type { EpubPage } from './epub-page';

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

/**
 * A book's page given a height (200px, its foot under ten lines) and each word a
 * line by where it stands among the chapter's: its scroller, to scroll.
 */
export function laidOut(page: EpubPage): HTMLElement {
  const scroller = page.element.querySelector('.page__scroll') as HTMLElement;
  Object.defineProperty(scroller, 'clientHeight', { configurable: true, get: () => 200 });
  Object.defineProperty(scroller, 'scrollHeight', { configurable: true, get: () => 2200 });
  scroller.getBoundingClientRect = () => ({ top: 0, bottom: 200 }) as DOMRect;
  const lines = linesOf(page.chapter, scroller);
  vi.spyOn(Range.prototype, 'getBoundingClientRect').mockImplementation(function (this: Range) {
    return lines(this) as DOMRect;
  });
  return scroller;
}
