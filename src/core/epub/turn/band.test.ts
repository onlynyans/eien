import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { BAND_BOX, bandOf, flatBand, inverse, times } from './band';
import { dot, lay, type Matrix, minus, type Point, rollOf, transform } from './curl';

const page = { width: 400, height: 600 };
const rest: Point = [400, 500];
const reach = 2000;
const near = (a: Point, b: Point) =>
  expect(Math.hypot(a[0] - b[0], a[1] - b[1])).toBeLessThan(1e-6);
const finite = fc.double({ min: -50, max: 50, noNaN: true });

describe('a band', () => {
  it('undoes a matrix with its inverse', () => {
    fc.assert(
      fc.property(finite, finite, finite, finite, finite, finite, (a, b, c, d, e, f) => {
        fc.pre(Math.abs(a * d - b * c) > 0.1);
        const m: Matrix = [a, b, c, d, e, f];
        const point: Point = [3, -7];
        const back = transform(times(inverse(m), m), point);
        return Math.hypot(back[0] - point[0], back[1] - point[1]) < 1e-6;
      }),
    );
  });

  it('has its box’s edges on its cuts across the fold, and reaches along it either side', () => {
    const roll = rollOf(page, rest, [150, 420]);
    const band = bandOf(roll, 10, 30, reach);
    const past = (p: Point) => dot(minus(p, roll.fold), roll.normal);
    for (const v of [0, reach, 2 * reach]) {
      expect(past(transform(band.place, [0, v]))).toBeCloseTo(10, 9);
      expect(past(transform(band.place, [BAND_BOX, v]))).toBeCloseTo(30, 9);
    }
  });

  // What makes a frame transforms alone: the box moves, and the page inside it moves back, so the
  // page's paper stands where the roll lays it (or, flat, where it was).
  it('lays the page inside it where the roll lays its paper', () => {
    const roll = rollOf(page, rest, [150, 420]);
    const laid = lay(roll, 10, 30);
    const band = bandOf(roll, 10, 30, reach, laid);
    const flat = bandOf(roll, -500, 0, reach);
    for (const point of [
      [0, 0],
      [123, 456],
      [400, 600],
    ] as Point[]) {
      near(transform(times(band.place, band.paper), point), transform(laid, point));
      near(transform(times(flat.place, flat.paper), point), point);
    }
  });

  it('flat, holds the whole page', () => {
    const band = flatBand(page, reach);
    for (const corner of [
      [0, 0],
      [400, 0],
      [400, 600],
      [0, 600],
    ] as Point[]) {
      const [u, v] = transform(band.paper, corner);
      expect(u).toBeGreaterThanOrEqual(-1e-9);
      expect(u).toBeLessThanOrEqual(BAND_BOX + 1e-9);
      expect(v).toBeGreaterThan(0);
      expect(v).toBeLessThan(2 * reach);
    }
  });
});
