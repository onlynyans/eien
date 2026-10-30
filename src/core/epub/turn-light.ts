// The light on a curling page (#40, Phase 3): the one place Eien's paper
// carries light, and only while it moves (.interface-design/system.md,
// Depth's exception). Each strip of the roll is shaded by how it faces you,
// edge-on darkest and facing you not at all, with a glint where its back
// tops the roll; ramped across the strip from one edge's angle to the
// other's, so the roll reads as one curve, not bands. The inks are the
// theme's tokens (--eien-curl-shade, --eien-curl-light); here a light is
// only where along the page and how strong, as a linear gradient's numbers.

import { dot, minus, onFold, type PageBox, type Point, type Roll } from './turn-curl';

/** A stop of a light: `at` pixels along its gradient line, the ink at `strength` (0 to 1). */
export interface Stop {
  readonly at: number;
  readonly strength: number;
}

/** A linear gradient across the page: its angle in degrees, as CSS measures it, and its stops. */
export interface Light {
  readonly angle: number;
  readonly stops: readonly Stop[];
}

/** Where past the crest the glint sits, of a half turn. */
const GLINT_AT = 0.78;
/** How tight the glint is: the power its falloff is raised to. */
const GLINT_TIGHT = 6;

/** A strip `angle` round the roll (0 lying flat, π back over): its shade, edge-on darkest. */
export const shadeAt = (angle: number): number => 1 - Math.abs(Math.cos(angle));

/** The glint where the back catches the light, just past the crest; none elsewhere. */
export const glintAt = (angle: number): number =>
  Math.max(0, Math.cos(angle - GLINT_AT * Math.PI)) ** GLINT_TIGHT;

/** A gradient running toward `toward` over the page: CSS's angle, and how long its line is. */
function lineOf(page: PageBox, toward: Point): { angle: number; length: number } {
  const radians = Math.atan2(toward[0], -toward[1]);
  return {
    angle: (radians * 180) / Math.PI,
    length: Math.abs(page.width * Math.sin(radians)) + Math.abs(page.height * Math.cos(radians)),
  };
}

/** How far along a gradient line `point` falls. */
const atOn = (page: PageBox, toward: Point, length: number, point: Point): number =>
  dot(minus(point, [page.width / 2, page.height / 2]), toward) + length / 2;

/** A wash along the fold: the ink whole at `from`, gone `length` pixels on toward `toward`. */
export function washFrom(page: PageBox, from: Point, toward: Point, length: number): Light {
  const line = lineOf(page, toward);
  const at = atOn(page, toward, line.length, from);
  return {
    angle: line.angle,
    stops: [
      { at: at - 0.5, strength: 0 },
      { at, strength: 1 },
      { at: at + length, strength: 0 },
    ],
  };
}

/** The ink across the strip `from` to `to` past the fold: `start` of it at one edge, `end` at the other. */
export function rampOver(
  page: PageBox,
  roll: Roll,
  from: number,
  to: number,
  start: number,
  end: number,
): Light {
  const line = lineOf(page, roll.normal);
  const at = (t: number) => atOn(page, roll.normal, line.length, onFold(roll, t));
  return {
    angle: line.angle,
    stops: [
      { at: at(from), strength: start },
      { at: at(to), strength: end },
    ],
  };
}
