import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { CURL_STRIPS, onFold, type Point, rollOf, transform } from './curl';
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

describe('a frame’s pieces fit together', () => {
  const inside = (polygon: readonly Point[], [x, y]: Point) => {
    // Convex, in order: the point on the same side of every edge (or on one).
    let sign = 0;
    for (let i = 0; i < polygon.length; i++) {
      const [ax, ay] = polygon[i] as Point;
      const [bx, by] = polygon[(i + 1) % polygon.length] as Point;
      const cross = (bx - ax) * (y - ay) - (by - ay) * (x - ax);
      if (Math.abs(cross) < 1e-6) continue;
      if (sign === 0) sign = Math.sign(cross);
      else if (Math.sign(cross) !== sign) return false;
    }
    return true;
  };

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
          const corner = transform(frame.back.matrix, at);
          if (Math.hypot(corner[0] - frame.corner[0], corner[1] - frame.corner[1]) > 1e-6)
            return false;
          const step = (Math.PI * roll.radius) / CURL_STRIPS;
          return frame.strips.every((strip, i) => {
            const next = frame.strips[i + 1];
            if (!next) return true;
            const edge = onFold(roll, (i + 1) * step);
            const a = transform(strip.matrix, edge);
            const b = transform(next.matrix, edge);
            return Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-6;
          });
        },
      ),
    );
  });

  it('keeps the spine’s corners in what stays, and the corner’s rest under the cast', () => {
    const frame = curlFrame(page, rest, [100, 450], lengths);
    if (frame.resting) throw new Error('moving');
    expect(inside(frame.front, [0, 0])).toBe(true);
    expect(inside(frame.front, [0, 600])).toBe(true);
    expect(inside(frame.cast.clip, rest)).toBe(true);
    expect(inside(frame.front, rest)).toBe(false);
  });

  it('shades the roll’s front darker as it turns edge-on, and lights the crest toward the corner', () => {
    const frame = curlFrame(page, rest, [0, 500], lengths);
    if (frame.resting) throw new Error('moving');
    const starts = frame.strips
      .slice(0, CURL_STRIPS / 2 + 1)
      .map((s) => s.shade.stops[0]?.strength ?? 0);
    expect(starts).toEqual([...starts].sort((a, b) => a - b));
    // The fold runs down the page here: its light runs across, toward the corner's rest.
    expect(frame.back.light.angle).toBeCloseTo(90, 9);
    const roll = rollOf(page, rest, frame.corner);
    expect(frame.cast.light.stops[1]?.at).toBeCloseTo(roll.fold[0] + roll.radius, 6);
  });
});
