import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { BAND_BOX, type Band, times } from './band';
import { CURL_STRIPS, onFold, type Point, rollOf, transform } from './curl';
import { curlFrame, reachOf } from './curl-frame';

const page = { width: 400, height: 600 };
const rest: Point = [400, 500];
const lengths = { cast: 32, crest: 24 };

/** Whether `point` on the page falls in `band`'s box: across it, and within its reach along the fold. */
const holds = (band: Band, point: Point) => {
  const [u, v] = transform(band.paper, point);
  return u >= 0 && u <= BAND_BOX && v >= 0 && v <= 2 * reachOf(page);
};
/** Where `band` lays the page's `point`. */
const laid = (band: Band, point: Point) => transform(times(band.place, band.paper), point);

describe('a frame', () => {
  it('at rest, lays the page flat and nothing else', () => {
    const frame = curlFrame(page, rest, rest, lengths);
    expect(frame.resting).toBe(true);
    expect(frame.corner).toEqual(rest);
    for (const corner of [
      [0, 0],
      [400, 0],
      [400, 600],
      [0, 600],
    ] as Point[]) {
      expect(holds(frame.front, corner)).toBe(true);
    }
  });

  it('half over: what stays, twelve strips, what lies back and its crest, the shadow beneath', () => {
    const frame = curlFrame(page, rest, [0, 500], lengths);
    if (frame.resting) throw new Error('moving');
    expect(frame.strips).toHaveLength(CURL_STRIPS);
    const roll = rollOf(page, rest, frame.corner);
    // The shadow runs the cast's length from where the roll stands; the crest's light its own.
    const castFrom = transform(frame.cast.place, [0, 0])[0];
    expect(castFrom).toBeCloseTo(roll.fold[0] + roll.radius, 6);
    expect(transform(frame.cast.place, [BAND_BOX, 0])[0] - castFrom).toBeCloseTo(lengths.cast, 6);
    const crest = [0, BAND_BOX].map((u) => transform(frame.crest.place, [u, 0])[0]);
    expect(Math.abs((crest[1] ?? 0) - (crest[0] ?? 0))).toBeCloseTo(lengths.crest, 6);
  });

  it('a crease too slight to round draws no strips', () => {
    const frame = curlFrame(page, rest, [399, 500], lengths);
    if (frame.resting) throw new Error('moving');
    expect(frame.strips).toEqual([]);
  });

  it('keeps the spine’s corners in what stays, and the corner’s rest out of it', () => {
    const frame = curlFrame(page, rest, [100, 450], lengths);
    if (frame.resting) throw new Error('moving');
    expect(holds(frame.front, [0, 0])).toBe(true);
    expect(holds(frame.front, [0, 600])).toBe(true);
    expect(holds(frame.front, rest)).toBe(false);
    expect(holds(frame.back, rest)).toBe(true);
  });
});

describe('a frame’s pieces fit together', () => {
  it('lays the corner’s paper where the hand holds it, the strips edge to edge', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -0.9, max: 0.95, noNaN: true }),
        fc.double({ min: 0.1, max: 0.9, noNaN: true }),
        (x, grip) => {
          const at: Point = [400, grip * 600];
          const frame = curlFrame(page, at, [x * 400, grip * 600], lengths);
          if (frame.resting) return true;
          const roll = rollOf(page, at, frame.corner);
          const corner = laid(frame.back, at);
          if (Math.hypot(corner[0] - frame.corner[0], corner[1] - frame.corner[1]) > 1e-6)
            return false;
          const step = (Math.PI * roll.radius) / CURL_STRIPS;
          return frame.strips.every((strip, i) => {
            const next = frame.strips[i + 1];
            if (!next) return true;
            const edge = onFold(roll, (i + 1) * step);
            const a = laid(strip, edge);
            const b = laid(next, edge);
            return Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-6;
          });
        },
      ),
    );
  });
});
