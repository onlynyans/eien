import { describe, expect, it } from 'vitest';
import { curlTime, isInstant, SLOWEST, slideTime, turnScale, wordsTime } from './speed';

describe('the speed', () => {
  it('scales the designed time from instant to four times slower, as designed when unreadable', () => {
    expect(turnScale(0)).toBe(0);
    expect(turnScale(2)).toBe(2);
    expect(turnScale(9)).toBe(SLOWEST);
    expect(turnScale(-1)).toBe(0);
    expect(turnScale(Number.NaN)).toBe(1);
  });

  it('times each motion from the tokens’ calm and quick', () => {
    expect(curlTime(220, 2)).toBe(660);
    expect(curlTime(220, 1, 1.1)).toBeCloseTo(363, 9);
    expect(slideTime(220, 2)).toBe(440);
    expect(wordsTime(120, 220, 1)).toEqual({ out: 120, in: 220 });
  });

  it('is instant at speed 0 and under reduced motion (the tokens at 0)', () => {
    expect(isInstant(curlTime(220, 0))).toBe(true);
    expect(isInstant(curlTime(0, 2))).toBe(true);
    expect(isInstant(slideTime(220, 1))).toBe(false);
  });
});
