// A key's or a click's turn is a hand's (#40, Phase 3), and a hand never
// turns two pages alike. Where it takes the edge, how high the corner rises,
// how fast and where the arc peaks each wander from the last turn's by at
// most a third of their range, and never past their bounds: turned back at a
// bound rather than held there, so a run of turns never sticks at an edge.
// The turns differ as one hand's do, and never jump.

export interface Stroke {
  /** Where the edge is taken, of the page's height from its top. */
  readonly grip: number;
  /** How high the corner rises on its arc, of the page's height. */
  readonly lift: number;
  /** Its pace, against the turn's time. */
  readonly pace: number;
  /** Where the arc peaks: under 1 early, over 1 late. */
  readonly skew: number;
}

/** Each part's bounds, as the approved curl has them. */
export const STROKE_BOUNDS: { readonly [K in keyof Stroke]: readonly [number, number] } = {
  grip: [0.74, 0.94],
  lift: [0.06, 0.16],
  pace: [0.9, 1.1],
  skew: [0.8, 1.25],
};

/** The most a part wanders from one turn to the next: a third of its range. */
export const WANDER = 1 / 3;

const PARTS = Object.keys(STROKE_BOUNDS) as (keyof Stroke)[];

/** The first turn's: each part at the middle of its bounds. */
export const FIRST_STROKE: Stroke = Object.fromEntries(
  PARTS.map((part) => {
    const [low, high] = STROKE_BOUNDS[part];
    return [part, (low + high) / 2];
  }),
) as unknown as Stroke;

/** `value` turned back into [low, high] at whichever bound it passed. */
const reflected = (value: number, low: number, high: number): number =>
  Math.min(
    high,
    Math.max(low, value > high ? 2 * high - value : value < low ? 2 * low - value : value),
  );

/** The next turn's stroke after `last`, `random` giving numbers in [0, 1). */
export function nextStroke(last: Stroke, random: () => number): Stroke {
  return Object.fromEntries(
    PARTS.map((part) => {
      const [low, high] = STROKE_BOUNDS[part];
      const wander = (random() * 2 - 1) * (high - low) * WANDER;
      return [part, reflected(last[part] + wander, low, high)];
    }),
  ) as unknown as Stroke;
}

/**
 * The corner's height on a key's arc, `progress` (0 to 1) of the way over:
 * from where it was taken, `taken`, up and over and down as it lands, on a
 * page `height` high.
 */
export const arcHeight = (
  stroke: Stroke,
  taken: number,
  height: number,
  progress: number,
): number =>
  taken -
  stroke.lift * height * Math.sin(Math.PI * Math.min(1, Math.max(0, progress)) ** stroke.skew);
