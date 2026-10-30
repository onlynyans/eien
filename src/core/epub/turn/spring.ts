// The curl's finish (#40, Phase 3): after you let go, or for a key's turn,
// the corner is carried to where it's going by a spring with exactly
// enough damping never to overshoot. It starts at the hand's own speed and
// settles; a throw hard enough to carry it past its mark stops there, so it
// lands and never bounces back. Times in milliseconds, places in pixels.

import { dot, minus, type Point } from './curl';

/** The corner moving: where it is, and its speed in pixels a millisecond. */
export interface Moving {
  readonly at: Point;
  readonly speed: Point;
}

/** The spring's steps within a frame, at most this long, so a long frame stays true. */
const SUBSTEP_MS = 4;
/** A frame longer than this (a stalled window) counts as this long, so the page never leaps. */
export const FRAME_CAP_MS = 48;
/** Within this of its mark, in pixels, and slower than SETTLED_SPEED, it has landed. */
const SETTLED_AT = 0.5;
const SETTLED_SPEED = 0.02;
/**
 * Critically damped, the spring closes to within half a pixel of two page
 * widths in about 10/ω: with ω = 11/time, it lands within `time`.
 */
const CLOSES_IN = 11;

/** Steps no longer than this over ω, however short the finish, so the spring stays true (never runs away). */
const STEADY = 0.5;

/** The spring's ω for a finish that lands in `time`; Infinity (at once) for one shorter than a step. */
export const omegaFor = (time: number): number =>
  time >= SUBSTEP_MS ? CLOSES_IN / time : Infinity;

/** Whether `moving` has come to rest on `target`. */
export const settled = (moving: Moving, target: Point): boolean =>
  Math.hypot(moving.at[0] - target[0], moving.at[1] - target[1]) < SETTLED_AT &&
  Math.hypot(moving.speed[0], moving.speed[1]) < SETTLED_SPEED;

/**
 * `moving` carried `elapsed` milliseconds toward `target` by a spring of
 * `omega`. `heightAt`, if given, sets the height for each step's place
 * across (a key's turn riding its arc), the spring moving it across alone. Landed once settled, or once a step would have carried it
 * past the target: then it's on it, with no speed.
 */
export function springStep(
  moving: Moving,
  target: Point,
  omega: number,
  elapsed: number,
  heightAt?: (x: number) => number,
): { readonly moving: Moving; readonly landed: boolean } {
  if (!Number.isFinite(omega)) return { moving: { at: target, speed: [0, 0] }, landed: true };
  let [x, y] = moving.at;
  let [vx, vy] = moving.speed;
  let left = Math.min(FRAME_CAP_MS, Math.max(0, elapsed));
  while (left > 0) {
    const h = Math.min(SUBSTEP_MS, STEADY / omega, left);
    left -= h;
    const was: Point = [x, y];
    vx += (-omega * omega * (x - target[0]) - 2 * omega * vx) * h;
    vy += (-omega * omega * (y - target[1]) - 2 * omega * vy) * h;
    x += vx * h;
    y += vy * h;
    if (heightAt) {
      y = heightAt(x);
      vy = 0;
    }
    if (dot(minus([x, y], target), minus(was, target)) < 0) {
      return { moving: { at: target, speed: [0, 0] }, landed: true };
    }
  }
  const next: Moving = { at: [x, y], speed: [vx, vy] };
  return settled(next, target)
    ? { moving: { at: target, speed: [0, 0] }, landed: true }
    : { moving: next, landed: false };
}
