import { describe, expect, it } from 'vitest';
import { spotOf } from './place';

describe('a place in a chapter', () => {
  it('falls in the piece of text that holds it, an end being the next one’s start', () => {
    expect(spotOf([5, 3, 4], 0)).toEqual({ index: 0, within: 0 });
    expect(spotOf([5, 3, 4], 4)).toEqual({ index: 0, within: 4 });
    expect(spotOf([5, 3, 4], 5)).toEqual({ index: 1, within: 0 });
    expect(spotOf([5, 3, 4], 11)).toEqual({ index: 2, within: 3 });
  });

  it('clamps to the words there are, and skips empty pieces', () => {
    expect(spotOf([5, 3], 99)).toEqual({ index: 1, within: 3 });
    expect(spotOf([5, 3], -4)).toEqual({ index: 0, within: 0 });
    expect(spotOf([5, 3], Number.NaN)).toEqual({ index: 0, within: 0 });
    expect(spotOf([0, 0, 2], 1)).toEqual({ index: 2, within: 1 });
    expect(spotOf([], 3)).toBeNull();
    expect(spotOf([0], 3)).toBeNull();
  });
});
