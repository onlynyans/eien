// A place in a drawn chapter (#40, Phase 2), on the tests' own layout
// (./test-lines.ts).

import { afterEach, describe, expect, it } from 'vitest';
import { firstInSight, piecesOf, showOffset } from './chapter-place';
import { linesOf } from './test-lines';

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

afterEach(() => document.body.replaceChildren());

describe('a place in a drawn chapter', () => {
  it('counts the book’s words alone: not the space between blocks, nor Eien’s own', () => {
    const chapter = chapterOf('One two.', 'Three.');
    expect(piecesOf(chapter).map((piece) => piece.data)).toEqual(['One two.', 'Three.']);
  });

  it('is the first line in sight, by its first word', () => {
    const chapter = chapterOf('a'.repeat(25), 'b'.repeat(30));
    const scroller = { scrollTop: 0 };
    const rectOf = linesOf(chapter, scroller);
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
    const rectOf = linesOf(chapter, scroller);
    showOffset(chapter, scroller, 34, rectOf);
    expect(scroller.scrollTop).toBe(60);
    expect(firstInSight(chapter, 0, rectOf)).toBe(30);
    showOffset(chapter, scroller, 0, rectOf);
    expect(scroller.scrollTop).toBe(0);
  });
});
