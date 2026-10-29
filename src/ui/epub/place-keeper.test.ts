// A book's place kept as its page scrolls (#40, Phase 2): told each frame,
// kept once the scroll rests, never measured out of sight, and shown again
// when the page is put back. The layout is the test's (happy-dom has none):
// lines of ten characters, 20px each.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RectOf } from './chapter-place';
import { PlaceKeeper, REST_MS } from './place-keeper';

let scroller: HTMLElement;
let chapter: HTMLElement;
let height: number;
const moved = vi.fn();
const rested = vi.fn();

/** Each character's line, from where it stands in the chapter's one paragraph. */
const rectOf: RectOf = (range) => {
  const line = (at: number) => Math.floor(at / 10) * 20 - scroller.scrollTop;
  return {
    top: line(range.startOffset),
    bottom: line(Math.max(range.startOffset, range.endOffset - 1)) + 20,
  };
};

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame'],
  });
  scroller = document.createElement('div');
  chapter = document.createElement('div');
  chapter.innerHTML = `<p>${'w'.repeat(200)}</p>`;
  scroller.append(chapter);
  document.body.append(scroller);
  height = 100;
  Object.defineProperty(scroller, 'clientHeight', { get: () => height });
  Object.defineProperty(scroller, 'scrollHeight', { get: () => 400 });
  moved.mockClear();
  rested.mockClear();
});
afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
});

const keeper = () => new PlaceKeeper({ scroller, chapter, moved, rested, rectOf });
const scrollTo = (top: number) => {
  scroller.scrollTop = top;
  scroller.dispatchEvent(new Event('scroll'));
};

describe('a book’s place as its page scrolls', () => {
  it('tells how far through the chapter each frame, and keeps the line once the scroll rests', () => {
    const kept = keeper();
    scrollTo(60);
    scrollTo(150);
    vi.advanceTimersByTime(REST_MS - 1);
    expect(moved).toHaveBeenLastCalledWith(0.5);
    expect(rested).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    // 150px down is the eighth line's middle: still in sight, so it's the place.
    expect(rested).toHaveBeenCalledExactlyOnceWith(70);
    expect(kept.offset).toBe(70);
    // At rest where it was: nothing new to keep.
    scrollTo(150);
    vi.advanceTimersByTime(REST_MS);
    expect(rested).toHaveBeenCalledTimes(1);
  });

  it('never measures a page out of sight: what it kept stands', () => {
    const kept = keeper();
    scrollTo(100);
    vi.advanceTimersByTime(REST_MS);
    expect(kept.offset).toBe(50);
    height = 0; // a phone's page gone back to the list
    scrollTo(0);
    vi.advanceTimersByTime(REST_MS);
    kept.keep();
    expect(kept.offset).toBe(50);
    expect(rested).toHaveBeenCalledTimes(1);
  });

  it('keeps a rest on its way at once when asked (a page closing, the window quitting)', () => {
    const kept = keeper();
    scrollTo(40);
    kept.keep();
    expect(rested).toHaveBeenCalledExactlyOnceWith(20);
    vi.advanceTimersByTime(REST_MS);
    expect(rested).toHaveBeenCalledTimes(1);
    scrollTo(80);
    kept.dispose();
    expect(rested).toHaveBeenLastCalledWith(40);
  });

  it('shows a place with its line at the top, kept without writing it again', () => {
    const kept = keeper();
    kept.show(73);
    expect(scroller.scrollTop).toBe(140);
    expect(kept.offset).toBe(70);
    scroller.dispatchEvent(new Event('scroll'));
    vi.advanceTimersByTime(REST_MS);
    expect(rested).not.toHaveBeenCalled();
  });

  it('shows the place again when put back in the window, its scroll gone to the top', () => {
    const kept = keeper();
    scrollTo(100);
    vi.advanceTimersByTime(REST_MS);
    scroller.scrollTop = 0; // taken out and put back
    kept.placed();
    expect(scroller.scrollTop).toBe(100);
    // Out of sight, it waits: nothing to lay the line out against.
    height = 0;
    scroller.scrollTop = 0;
    kept.placed();
    expect(scroller.scrollTop).toBe(0);
  });
});
