// A place in a drawn chapter (#40, Phase 2), on a layout the test lays out
// (happy-dom lays out nothing): every word on lines of ten characters, each
// line 20px, under a scroller whose top is the window's top.

import { afterEach, describe, expect, it } from 'vitest';
import { firstInSight, piecesOf, type RectOf, showOffset } from './chapter-place';

const LINE = 20;
const PER_LINE = 10;

/** A chapter of paragraphs, with Eien's own scene break and a picture's words between. */
function chapterOf(...paragraphs: string[]): HTMLElement {
  const chapter = document.createElement('div');
  chapter.innerHTML = `<p>${paragraphs[0]}</p>\n  <div class="scene-break">***</div>\n${paragraphs
    .slice(1)
    .map((words) => `<p>${words}<span class="image-words">[Plate]</span></p>`)
    .join('\n')}`;
  document.body.append(chapter);
  return chapter;
}

/** Each character's line, by its place among the chapter's words, under a scroller scrolled `scroller.scrollTop`. */
const lines =
  (chapter: HTMLElement, scroller: { scrollTop: number }): RectOf =>
  (range) => {
    const pieces = piecesOf(chapter);
    let at = 0;
    for (const piece of pieces) {
      if (piece === range.startContainer) break;
      at += piece.length;
    }
    const start = Math.floor((at + range.startOffset) / PER_LINE) * LINE - scroller.scrollTop;
    const end = Math.floor((at + Math.max(range.startOffset, range.endOffset - 1)) / PER_LINE);
    return { top: start, bottom: end * LINE - scroller.scrollTop + LINE };
  };

afterEach(() => document.body.replaceChildren());

describe('a place in a drawn chapter', () => {
  it('counts the book’s words alone: not the space between blocks, nor Eien’s own', () => {
    const chapter = chapterOf('One two.', 'Three.');
    expect(piecesOf(chapter).map((piece) => piece.data)).toEqual(['One two.', 'Three.']);
  });

  it('is the first line in sight, by its first word', () => {
    const chapter = chapterOf('a'.repeat(25), 'b'.repeat(30));
    const scroller = { scrollTop: 0 };
    const rectOf = lines(chapter, scroller);
    expect(firstInSight(chapter, 0, rectOf)).toBe(0);
    scroller.scrollTop = 20; // the second line at the top
    expect(firstInSight(chapter, 0, rectOf)).toBe(10);
    scroller.scrollTop = 50; // halfway down the third: it's still in sight
    expect(firstInSight(chapter, 0, rectOf)).toBe(20);
    scroller.scrollTop = 60;
    expect(firstInSight(chapter, 0, rectOf)).toBe(30);
    scroller.scrollTop = 10_000; // past the words: read to the end
    expect(firstInSight(chapter, 0, rectOf)).toBe(55);
    expect(firstInSight(chapterOf(''), 0, rectOf)).toBe(0);
  });

  it('is shown again with its line at the scroller’s top, and measures the same there', () => {
    const chapter = chapterOf('a'.repeat(25), 'b'.repeat(30));
    const scroller = document.createElement('div');
    document.body.append(scroller);
    const rectOf = lines(chapter, scroller);
    showOffset(chapter, scroller, 34, rectOf);
    expect(scroller.scrollTop).toBe(60);
    expect(firstInSight(chapter, 0, rectOf)).toBe(30);
    showOffset(chapter, scroller, 0, rectOf);
    expect(scroller.scrollTop).toBe(0);
  });
});
