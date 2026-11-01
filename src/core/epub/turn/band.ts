// A piece of the curl as a band (#40, Phase 3; made smooth on a phone): a
// strip of paper across the page, square to the fold, as a box that's only
// moved. The box is laid with its x along the fold's normal and its y along
// the fold, so its own edges are the piece's cuts; the page's paper inside
// it is laid back by the inverse, so it stands where it did. A window then
// changes only transforms as the page curls, never a clip or a gradient: a
// box drawn once is moved, never drawn again.

import { type Matrix, onFold, type PageBox, type Point, type Roll } from './curl';

/**
 * A band's box: `place` lays it on the page; `paper` lays the page's paper
 * back inside it, and `box` the box again inside the paper (its inverse), so
 * what's drawn across the band is cut to the page too.
 */
export interface Band {
  readonly place: Matrix;
  readonly paper: Matrix;
  readonly box: Matrix;
}

/** How wide a band's box is drawn, in its own pixels: its width on the page is a scale of it. */
export const BAND_BOX = 100;

/** `a` after `b`: the matrix that does `b`, then `a`. */
export function times(a: Matrix, b: Matrix): Matrix {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}

/** The matrix that undoes `m`. */
export function inverse(m: Matrix): Matrix {
  const det = m[0] * m[3] - m[1] * m[2];
  const [a, b, c, d] = [m[3] / det, -m[1] / det, -m[2] / det, m[0] / det];
  return [a, b, c, d, -(a * m[4] + c * m[5]), -(b * m[4] + d * m[5])];
}

/**
 * The band from `from` to `to` past the fold (along its normal), as long
 * as `reach` either side of the normal through the fold's point, laid by
 * `lay` (the roll's matrix for it; none for paper lying flat). Its box is
 * `BAND_BOX` wide and `2 × reach` tall.
 */
export function bandOf(roll: Roll, from: number, to: number, reach: number, lay?: Matrix): Band {
  const [nx, ny] = roll.normal;
  const origin: Point = onFold(roll, from);
  const scale = (to - from) / BAND_BOX;
  // x along the normal (scaled to the band's width), y along the fold, starting `reach` before the fold's point.
  const box: Matrix = [
    nx * scale,
    ny * scale,
    -ny,
    nx,
    origin[0] + reach * ny,
    origin[1] - reach * nx,
  ];
  return { place: lay ? times(lay, box) : box, paper: inverse(box), box };
}

/** The whole page lying flat, as one band: the curl at rest. */
export const flatBand = (page: PageBox, reach: number): Band =>
  bandOf(
    { fold: [0, page.height / 2], normal: [1, 0], radius: 0, travel: 0 },
    0,
    page.width,
    reach,
  );
