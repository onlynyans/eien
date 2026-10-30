import { describe, expect, it } from 'vitest';
import { CURL_STRIPS, type Point } from './curl';
import { curlFrame } from './curl-frame';

const page = { width: 400, height: 600 };
const rest: Point = [400, 500];
const lengths = { cast: 32, crest: 24 };

describe('a frame', () => {
  it('draws nothing at rest', () => {
    expect(curlFrame(page, rest, rest, lengths)).toEqual({ resting: true, corner: rest });
  });

  it('half over: what stays, twelve strips (the back half glinting), what lies back, the shadow beneath', () => {
    const frame = curlFrame(page, rest, [0, 500], lengths);
    if (frame.resting) throw new Error('moving');
    expect(frame.strips).toHaveLength(CURL_STRIPS);
    expect(frame.strips.filter((strip) => strip.back)).toHaveLength(CURL_STRIPS / 2);
    expect(frame.strips.every((strip) => (strip.glint !== null) === strip.back)).toBe(true);
    expect(frame.front.length).toBeGreaterThan(2);
    expect(frame.cast.clip.length).toBeGreaterThan(2);
    // The shadow runs the cast's length from the fold, the crest's light its own.
    const [, whole, gone] = frame.cast.light.stops;
    expect((gone?.at ?? 0) - (whole?.at ?? 0)).toBeCloseTo(lengths.cast, 9);
    const crest = frame.back.light.stops;
    expect((crest[2]?.at ?? 0) - (crest[1]?.at ?? 0)).toBeCloseTo(lengths.crest, 9);
  });

  it('a crease too slight to round draws no strips', () => {
    const frame = curlFrame(page, rest, [399, 500], lengths);
    if (frame.resting) throw new Error('moving');
    expect(frame.strips).toEqual([]);
  });
});
