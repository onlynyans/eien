import { describe, expect, it } from 'vitest';
import { glintAt, shadeAt } from './light';

describe('the light', () => {
  it('shades a strip by how it faces you: none flat, darkest edge-on', () => {
    expect(shadeAt(0)).toBeCloseTo(0, 9);
    expect(shadeAt(Math.PI / 2)).toBeCloseTo(1, 9);
    expect(shadeAt(Math.PI)).toBeCloseTo(0, 9);
  });

  it('glints just past the crest, nowhere near its start', () => {
    expect(glintAt(0.78 * Math.PI)).toBeCloseTo(1, 9);
    expect(glintAt(0)).toBe(0);
  });
});
