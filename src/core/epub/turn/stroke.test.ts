import { describe, expect, it } from 'vitest';
import { arcHeight, FIRST_STROKE, nextStroke, STROKE_BOUNDS } from './stroke';

describe('a key’s stroke', () => {
  it('starts at the middle of its bounds', () => {
    expect(FIRST_STROKE.grip).toBeCloseTo(0.84, 9);
    expect(FIRST_STROKE.pace).toBeCloseTo(1, 9);
  });

  it('turns back at a bound rather than holding there', () => {
    const atTop = { ...FIRST_STROKE, grip: STROKE_BOUNDS.grip[1] };
    const next = nextStroke(atTop, () => 1 - Number.EPSILON);
    expect(next.grip).toBeLessThan(STROKE_BOUNDS.grip[1]);
  });

  it('rises on its arc and lands where it was taken', () => {
    expect(arcHeight(FIRST_STROKE, 500, 600, 0)).toBe(500);
    expect(arcHeight(FIRST_STROKE, 500, 600, 1)).toBeCloseTo(500, 9);
    expect(arcHeight(FIRST_STROKE, 500, 600, 0.5)).toBeLessThan(500);
  });
});
