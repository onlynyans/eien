// Eien's own icons, as drawn: each inside its 16-unit grid, and the quick
// look's Aa a serif (#73), apart from Find's sans Match case.

import { describe, expect, it } from 'vitest';
import { ICONS, type IconName, icon } from './icons';

type Point = readonly [number, number];
type Segment = { readonly from: Point; readonly to: Point; readonly command: string };

/** Each segment of `d` from where it starts to where it ends (a curve's controls left out). */
function segments(d: string): Segment[] {
  const tokens = d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)/gu) ?? [];
  const arity: Record<string, number> = { m: 2, l: 2, h: 1, v: 1, c: 6, s: 4, q: 4, t: 2, a: 7 };
  const found: Segment[] = [];
  let at: Point = [0, 0];
  let start: Point = [0, 0];
  let command = '';
  for (let i = 0; i < tokens.length; ) {
    if (/[a-zA-Z]/u.test(tokens[i] as string)) command = tokens[i++] as string;
    const lower = command.toLowerCase();
    if (lower === 'z') {
      found.push({ from: at, to: start, command });
      at = start;
      continue;
    }
    const n = tokens.slice(i, i + (arity[lower] ?? 0)).map(Number);
    i += arity[lower] ?? 0;
    const relative = command === lower;
    const [x0, y0] = relative ? at : [0, 0];
    let to: Point;
    if (lower === 'h') to = [x0 + (n[0] ?? 0), at[1]];
    else if (lower === 'v') to = [at[0], y0 + (n[0] ?? 0)];
    else to = [x0 + (n.at(-2) ?? 0), y0 + (n.at(-1) ?? 0)];
    if (lower === 'm') {
      start = to;
      // Pairs after a move are lines.
      command = relative ? 'l' : 'L';
    } else found.push({ from: at, to, command });
    at = to;
  }
  return found;
}

/** An icon's segments, every path's, and its circles' extents. */
function drawing(name: IconName) {
  const svg = icon(name);
  const lines = [...svg.querySelectorAll('path')].flatMap((path) =>
    segments(path.getAttribute('d') ?? ''),
  );
  const points = lines.flatMap(({ from, to }) => [from, to]);
  for (const circle of svg.querySelectorAll('circle')) {
    const [cx, cy, r] = ['cx', 'cy', 'r'].map((name) => Number(circle.getAttribute(name)));
    points.push(
      [(cx ?? 0) - (r ?? 0), (cy ?? 0) - (r ?? 0)],
      [(cx ?? 0) + (r ?? 0), (cy ?? 0) + (r ?? 0)],
    );
  }
  return { lines, points };
}

describe('Eien’s icons', () => {
  it('each lie inside the 16-unit grid they’re drawn on', () => {
    for (const name of Object.keys(ICONS) as IconName[]) {
      for (const [x, y] of drawing(name).points) {
        expect(x, name).toBeGreaterThanOrEqual(0);
        expect(x, name).toBeLessThanOrEqual(16);
        expect(y, name).toBeGreaterThanOrEqual(0);
        expect(y, name).toBeLessThanOrEqual(16);
      }
    }
  });
});

describe('the quick look’s Aa (#73)', () => {
  const baseline = 13;
  /** Short level strokes standing on the baseline, in the capital's half. */
  const footSerifs = (name: IconName) =>
    drawing(name).lines.filter(
      ({ from, to }) =>
        from[1] === baseline &&
        to[1] === baseline &&
        Math.max(from[0], to[0]) < 9.5 &&
        Math.abs(to[0] - from[0]) > 0 &&
        Math.abs(to[0] - from[0]) <= 2.5,
    );

  it('is a serif: a foot serif under each of the A’s legs', () => {
    const serifs = footSerifs('look');
    expect(serifs).toHaveLength(2);
    // A leg: a stroke from above down to the baseline, in the capital's half; where it stands.
    const feet = drawing('look')
      .lines.flatMap(({ from, to }): (readonly [Point, Point])[] => [
        [from, to],
        [to, from],
      ])
      .filter(([foot, top]) => foot[1] === baseline && top[1] < baseline - 4 && foot[0] < 9.5)
      .map(([foot]) => foot[0]);
    expect(feet).toHaveLength(2);
    // Each leg stands inside a serif, the serif either side of it.
    for (const x of feet) {
      expect(
        serifs.some(({ from, to }) => Math.min(from[0], to[0]) < x && x < Math.max(from[0], to[0])),
        `the leg at ${x}`,
      ).toBe(true);
    }
  });

  it('is drawn apart from Find’s Match case, which keeps its sans Aa', () => {
    expect(ICONS.look).not.toBe(ICONS.matchCase);
    expect(footSerifs('matchCase')).toHaveLength(0);
  });
});
