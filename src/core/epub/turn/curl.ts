// The curl's geometry (#40, Phase 3): a page bending as paper does. The
// corner you hold is under your hand; the paper leaves the page at a fold
// line, rolls over a cylinder whose axis follows the corner, and lies back
// on itself beyond. The roll is laid as strips of the live page, each a flat
// piece where its part of the cylinder falls, so the free edges curve.
// Everything is in the page's own pixels (0..width × 0..height), with the
// spine at its left; the window turns these numbers into transforms alone
// (./band.ts). The approved motion: docs/design/explorations/epub-flip-curl.html.

export type Point = readonly [number, number];
/** An affine transform, CSS's matrix(a, b, c, d, e, f). */
export type Matrix = readonly [number, number, number, number, number, number];

export interface PageBox {
  readonly width: number;
  readonly height: number;
}

/** The roll for one place of the corner: where the paper leaves the page, which way, how round. */
export interface Roll {
  /** A point on the fold line. */
  readonly fold: Point;
  /** The fold's normal, toward the corner's rest: the lifted side. */
  readonly normal: Point;
  readonly radius: number;
  /** How far the corner has come from its rest. */
  readonly travel: number;
}

/** The strips the roll is drawn in: round at reading size, few enough for a phone. */
export const CURL_STRIPS = 12;
/** How round the roll is at its roundest, half way over: a fifth of the page's width. */
const ROUNDEST = 1 / 5;
/** A hair of overlap between pieces, in pixels, so no seam of the page beneath shows through. */
export const SEAM = 0.4;
/** Closer than this to its rest (in pixels), the corner is at rest and nothing is drawn. */
export const AT_REST = 0.5;
/** The steps, by halves, in finding how far the corner may go before the spine would lift. */
const HOLD_STEPS = 14;

export const dot = (a: Point, b: Point): number => a[0] * b[0] + a[1] * b[1];
export const minus = (a: Point, b: Point): Point => [a[0] - b[0], a[1] - b[1]];
const unit = (v: Point): Point => {
  const length = Math.hypot(v[0], v[1]) || 1;
  return [v[0] / length, v[1] / length];
};
const along = (a: Point, b: Point, t: number): Point => [
  a[0] + t * (b[0] - a[0]),
  a[1] + t * (b[1] - a[1]),
];
/** The point `t` along the normal from the fold. */
export const onFold = (roll: Roll, t: number): Point => [
  roll.fold[0] + roll.normal[0] * t,
  roll.fold[1] + roll.normal[1] * t,
];

/** How round the roll is `travel` from rest: flat at rest and once turned (two widths on), roundest half way. */
export const radiusAt = (page: PageBox, travel: number): number =>
  page.width * ROUNDEST * Math.sin(Math.PI * Math.min(1, Math.max(0, travel / (2 * page.width))));

/**
 * The roll with the corner resting at `rest` and now at `corner`: the corner
 * is (travel + πr) / 2 of paper from the fold, and lands πr less than that
 * back again, so the fold is there.
 */
export function rollOf(page: PageBox, rest: Point, corner: Point): Roll {
  const travel = Math.hypot(rest[0] - corner[0], rest[1] - corner[1]);
  const normal = unit(minus(rest, corner));
  const radius = radiusAt(page, travel);
  const back = (travel + Math.PI * radius) / 2;
  return {
    fold: [rest[0] - normal[0] * back, rest[1] - normal[1] * back],
    normal,
    radius,
    travel,
  };
}

/** Whether the spine's edge is still down with the corner at `corner`: neither of its corners lifted. */
export function spineDown(page: PageBox, rest: Point, corner: Point): boolean {
  const { fold, normal } = rollOf(page, rest, corner);
  return (
    dot(minus([0, 0], fold), normal) <= AT_REST &&
    dot(minus([0, page.height], fold), normal) <= AT_REST
  );
}

/**
 * Where the corner may be with the hand at `hand`: there, or the furthest
 * point on the way from its rest where the spine stays down. Paper doesn't
 * stretch, however far you pull.
 */
export function heldAt(page: PageBox, rest: Point, hand: Point): Point {
  if (spineDown(page, rest, hand)) return hand;
  let low = 0;
  let high = 1;
  for (let step = 0; step < HOLD_STEPS; step++) {
    const middle = (low + high) / 2;
    if (spineDown(page, rest, along(rest, hand, middle))) low = middle;
    else high = middle;
  }
  return along(rest, hand, low);
}

/** Where paper `s` past the fold lies once rolled, along the normal: round the cylinder, then back on itself. */
export const rolledAt = (s: number, radius: number): number =>
  radius > 0 && s <= Math.PI * radius ? radius * Math.sin(s / radius) : Math.PI * radius - s;

/**
 * The paper from `from` to `to` past the fold, laid as one flat piece where
 * the roll puts its ends: squeezed along the normal where the cylinder turns
 * it away, mirrored where it comes back over.
 */
export function lay(roll: Roll, from: number, to: number): Matrix {
  const { normal: n, radius } = roll;
  const [a0, b0] = [rolledAt(from, radius), rolledAt(to, radius)];
  const k = (b0 - a0) / (to - from);
  const shift = a0 - k * from - (k - 1) * dot(roll.fold, n);
  const a = 1 + (k - 1) * n[0] * n[0];
  const b = (k - 1) * n[0] * n[1];
  const d = 1 + (k - 1) * n[1] * n[1];
  return [a, b, b, d, n[0] * shift, n[1] * shift];
}

/** Where `matrix` takes `point`. */
export const transform = (matrix: Matrix, [x, y]: Point): Point => [
  matrix[0] * x + matrix[2] * y + matrix[4],
  matrix[1] * x + matrix[3] * y + matrix[5],
];
