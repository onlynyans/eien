import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { EDGES, edgesOf, pageAt, pagesIn, wholeLines } from './pages';

describe('a chapter in pages', () => {
  it('is as tall as the whole lines its box holds, at least one', () => {
    expect(wholeLines(610, 30)).toBe(600);
    expect(wholeLines(600, 30)).toBe(600);
    expect(wholeLines(10, 30)).toBe(30);
    expect(wholeLines(610, 0)).toBe(610);
  });

  it('counts its pages from how far its columns run', () => {
    expect(pagesIn(400, 400, 48)).toBe(1);
    expect(pagesIn(400 * 3 + 48 * 2, 400, 48)).toBe(3);
    expect(pagesIn(0, 400, 48)).toBe(1);
    expect(pagesIn(1000, 0, 48)).toBe(1);
  });

  it('finds the page a word falls on, within the chapter’s pages', () => {
    expect(pageAt(0, 448, 3)).toBe(0);
    expect(pageAt(399, 448, 3)).toBe(0);
    expect(pageAt(448, 448, 3)).toBe(1);
    // A word a hair before its column, from rounding, is still on it.
    expect(pageAt(2 * 448 - 4, 448, 3)).toBe(2);
    expect(pageAt(9999, 448, 3)).toBe(2);
    expect(pageAt(-10, 448, 3)).toBe(0);
  });
});

describe('the fore-edge', () => {
  it('shows the pages read and to go in sixths, one while any are, none at an end', () => {
    expect(edgesOf(0, true)).toBe(0);
    expect(edgesOf(0, false)).toBe(EDGES);
    expect(edgesOf(0.01, true)).toBe(1);
    expect(edgesOf(0.99, false)).toBe(1);
    expect(edgesOf(1, false)).toBe(0);
    expect(edgesOf(0.5, true)).toBe(3);
  });

  it('never more than six, and as the book is read only gains before and loses after', () => {
    const through = fc.double({ min: 0, max: 1, noNaN: true });
    fc.assert(
      fc.property(through, through, (a, b) => {
        const [early, late] = a <= b ? [a, b] : [b, a];
        return (
          [early, late].every((t) => edgesOf(t, true) <= EDGES && edgesOf(t, false) <= EDGES) &&
          edgesOf(late, true) >= edgesOf(early, true) &&
          edgesOf(late, false) <= edgesOf(early, false)
        );
      }),
    );
  });
});
