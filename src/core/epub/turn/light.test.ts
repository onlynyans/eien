import { describe, expect, it } from 'vitest';
import { CURL_STRIPS } from './curl';
import { glintAt, isBack, shadeAt, stripLight } from './light';

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

  it('lights each strip the same at every moment: the front darkening as it turns edge-on, the back glinting', () => {
    const lights = Array.from({ length: CURL_STRIPS }, (_, i) => stripLight(i));
    const front = lights.slice(0, CURL_STRIPS / 2).map((light) => light.shade[0]);
    expect(front).toEqual([...front].sort((a, b) => a - b));
    // Edge to edge: each strip's last edge is the next one's first, so the roll reads as one curve.
    lights.slice(1).forEach((light, i) => {
      expect(light.shade[0]).toBeCloseTo(lights[i]?.shade[1] ?? Number.NaN, 9);
    });
    expect(lights.map((light, i) => (light.glint !== null) === isBack(i))).not.toContain(false);
  });
});
