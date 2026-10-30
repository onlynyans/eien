// A book's place kept as its page scrolls (#40, Phase 2): told each frame,
// kept once the scroll rests, never measured out of sight, never mistaken
// for Eien's own scroll, and shown again whenever the page is laid out anew
// or put back. Lines laid out by ./test-lines.ts.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlaceKeeper, REST_MS } from './place-keeper';
import { linesOf } from './test-lines';

let scroller: HTMLElement;
let chapter: HTMLElement;
let height: number;
let width: number;
const moved = vi.fn();
const rested = vi.fn();
const placed = vi.fn();

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
  width = 600;
  Object.defineProperty(scroller, 'clientHeight', { get: () => height });
  Object.defineProperty(scroller, 'scrollHeight', { get: () => 400 });
  chapter.getBoundingClientRect = () => ({ width, height: width === 0 ? 0 : 400 }) as DOMRect;
  moved.mockClear();
  rested.mockClear();
  placed.mockClear();
});
afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
});

/** A keeper over a chapter drawn at `offset`, its own scroll's event come and gone. */
function keeper(offset = 0): PlaceKeeper {
  const kept = new PlaceKeeper({
    scroller,
    chapter,
    moved,
    rested,
    placed,
    rectOf: linesOf(chapter, scroller),
  });
  kept.show(offset);
  scroller.dispatchEvent(new Event('scroll'));
  vi.advanceTimersToNextFrame();
  moved.mockClear();
  return kept;
}
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

  it('tells the lines in sight as it’s shown and at each rest, moved or not (Phase 4)', () => {
    // The page's foot 100px under its top: five lines of ten characters in sight.
    scroller.getBoundingClientRect = () => ({ top: 0, bottom: height }) as DOMRect;
    keeper(30);
    expect(placed).toHaveBeenLastCalledWith(30, 80);
    placed.mockClear();
    scrollTo(scroller.scrollTop);
    scrollTo(scroller.scrollTop + 1);
    vi.advanceTimersByTime(REST_MS);
    // Still the same first line: the place is the same, and the lines in sight told again.
    expect(rested).not.toHaveBeenCalled();
    expect(placed).toHaveBeenCalledOnce();
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

  it('keeps a scroll whose event hasn’t come yet, when asked (the pages swapped at once)', () => {
    const kept = keeper();
    scroller.scrollTop = 120; // no event yet
    kept.keep();
    expect(rested).toHaveBeenCalledExactlyOnceWith(60);
    expect(kept.offset).toBe(60);
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

  it('shows a place with its line at the top, kept as given, its own scroll never taken for the reader’s', () => {
    const kept = keeper(73);
    expect(scroller.scrollTop).toBe(140);
    expect(kept.offset).toBe(73);
    vi.advanceTimersByTime(REST_MS);
    expect(rested).not.toHaveBeenCalled();
  });

  it('puts the line back after the page is taken out and put back, a rest on its way kept first', () => {
    const kept = keeper(50);
    // The reader scrolls, and within the second the page is taken out (⇄, a page opened beside).
    scrollTo(160);
    kept.keep(); // taking: still laid out
    scroller.scrollTop = 0; // put back: its scroll at the top
    kept.reshow(); // placed
    expect(rested).toHaveBeenCalledExactlyOnceWith(80);
    expect(scroller.scrollTop).toBe(160);
    // The rest that was on its way never comes to measure the top.
    vi.advanceTimersByTime(REST_MS * 2);
    expect(rested).toHaveBeenCalledTimes(1);
    expect(kept.offset).toBe(80);
  });

  it('shows the line again when the page comes back in sight at the same width', async () => {
    const observed: ResizeObserverCallback[] = [];
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: ResizeObserverCallback) {
          observed.push(callback);
        }
        observe() {}
        disconnect() {}
      },
    );
    const kept = keeper(100);
    expect(scroller.scrollTop).toBe(200);
    const resize = () => observed[0]?.([], {} as ResizeObserver);
    // Hidden (a folded split's other page), and put back while hidden: nothing to lay out against.
    height = 0;
    width = 0;
    resize();
    scroller.scrollTop = 0;
    kept.reshow();
    expect(scroller.scrollTop).toBe(0);
    // In sight again, as wide as before.
    height = 100;
    width = 600;
    resize();
    expect(scroller.scrollTop).toBe(200);
    expect(kept.offset).toBe(100);
    vi.unstubAllGlobals();
  });

  it('with no chapter, tells nothing and keeps nothing (a refusal, the page emptied)', () => {
    const kept = keeper();
    scrollTo(100);
    kept.clear();
    scroller.dispatchEvent(new Event('scroll'));
    vi.advanceTimersByTime(REST_MS);
    expect(moved).not.toHaveBeenCalled();
    expect(rested).not.toHaveBeenCalled();
    expect(kept.offset).toBe(0);
  });
});
