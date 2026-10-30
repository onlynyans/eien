import { describe, expect, it } from 'vitest';
import { bookFraction, chapterFraction, percent, placeAt } from './progress';

const spine = (sizes: readonly number[], out: readonly number[] = []) =>
  sizes.map((size, at) => ({ size, linear: !out.includes(at) }));

describe('how far through', () => {
  it('a chapter: by its scroll, all of it in sight being the end', () => {
    expect(chapterFraction(0, 1000, 200)).toBe(0);
    expect(chapterFraction(400, 1000, 200)).toBe(0.5);
    expect(chapterFraction(900, 1000, 200)).toBe(1);
    expect(chapterFraction(0, 150, 200)).toBe(1);
  });

  it('the book: by its chapters’ sizes, those out of the reading order not counted', () => {
    expect(bookFraction(spine([100, 300]), 0, 0)).toBe(0);
    expect(bookFraction(spine([100, 300]), 1, 0)).toBe(0.25);
    expect(bookFraction(spine([100, 300]), 1, 0.5)).toBe(0.625);
    expect(bookFraction(spine([100, 300]), 1, 1)).toBe(1);
    expect(bookFraction(spine([100, 999, 300], [1]), 2, 0)).toBe(0.25);
    expect(bookFraction(spine([100, 999, 300], [1]), 1, 0.5)).toBe(0.25);
    expect(bookFraction([], 0, 0.5)).toBe(0);
  });

  it('says whole percent, rounded down, so 100% is only the end', () => {
    expect(percent(0)).toBe('0%');
    expect(percent(0.999)).toBe('99%');
    expect(percent(1)).toBe('100%');
    expect(percent(0.29)).toBe('29%');
    expect(percent(2)).toBe('100%');
  });
});

describe('a share of the book’s place (Phase 4d)', () => {
  const spine = [
    { size: 100, linear: true },
    { size: 900, linear: false },
    { size: 300, linear: true },
  ];

  it('is the chapter it falls in and how far into it, passing what’s out of the reading order', () => {
    expect(placeAt(spine, 0)).toEqual({ index: 0, within: 0 });
    expect(placeAt(spine, 0.125)).toEqual({ index: 0, within: 0.5 });
    expect(placeAt(spine, 0.25)).toEqual({ index: 2, within: 0 });
    expect(placeAt(spine, 1)).toEqual({ index: 2, within: 1 });
    expect(placeAt(spine, Number.NaN)).toEqual({ index: 0, within: 0 });
  });

  it('is nowhere in a book with nothing in its order, and the last chapter’s end in one of no size', () => {
    expect(placeAt([{ size: 5, linear: false }], 0.5)).toBeNull();
    expect(placeAt([{ size: 0, linear: true }], 0.5)).toEqual({ index: 0, within: 1 });
  });
});
