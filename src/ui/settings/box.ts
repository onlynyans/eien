// Where Settings sits over the window (spec §6): moved by its head, resized
// by its edges and corners, always inside the window and never smaller than
// it can be used. Only the arithmetic is here; ./frame.ts draws it. The box
// is this device's, kept in the window's own storage, as the panes are.

export interface Box {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** The window: its width and height. */
export interface Area {
  readonly w: number;
  readonly h: number;
}

/** What a drag holds: the head, which moves the box, or an edge or a corner, which resizes it. */
export type Grip = 'move' | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

export const GRIPS: readonly Exclude<Grip, 'move'>[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];

/** The smallest it can be used at (settings.md). */
export const MIN_W = 560;
export const MIN_H = 380;
/** The window it keeps clear of at every side. */
export const MARGIN = 8;
/** Where it first opens: --settings-inset, 64px above and below, 112px at the sides. */
export const INSET = { x: 112, y: 64 } as const;

/** Each edge a resize moves. Spelled out, so a move never resizes ('move' holds an "e"). */
const EDGES: Readonly<Record<Exclude<Grip, 'move'>, readonly ('n' | 's' | 'e' | 'w')[]>> = {
  n: ['n'],
  s: ['s'],
  e: ['e'],
  w: ['w'],
  ne: ['n', 'e'],
  nw: ['n', 'w'],
  se: ['s', 'e'],
  sw: ['s', 'w'],
};

/** The largest it can be: the window, less the margins; the least it can be, unless the window is less. */
const most = (area: Area) => ({ w: area.w - 2 * MARGIN, h: area.h - 2 * MARGIN });
const least = (area: Area) => ({
  w: Math.min(MIN_W, most(area).w),
  h: Math.min(MIN_H, most(area).h),
});
const clamp = (value: number, low: number, high: number) =>
  Math.min(Math.max(value, low), Math.max(low, high));

/** Where it opens before the writer moves it: at the inset, centred, at least its least size. */
export function firstBox(area: Area): Box {
  const { w, h } = fitted({ x: 0, y: 0, w: area.w - 2 * INSET.x, h: area.h - 2 * INSET.y }, area);
  return fitted({ x: (area.w - w) / 2, y: (area.h - h) / 2, w, h }, area);
}

/** `box` kept inside the window and at least its least size: the size first, then the place. */
export function fitted(box: Box, area: Area): Box {
  const big = most(area);
  const small = least(area);
  const w = Math.round(clamp(box.w, small.w, big.w));
  const h = Math.round(clamp(box.h, small.h, big.h));
  return {
    x: Math.round(clamp(box.x, MARGIN, area.w - MARGIN - w)),
    y: Math.round(clamp(box.y, MARGIN, area.h - MARGIN - h)),
    w,
    h,
  };
}

/**
 * The box after a drag of `grip` by `dx`, `dy` from `start`. A move keeps
 * the size and stops at the window's edge; a resize moves only its edges,
 * the others staying where they were, and each stops at the window's edge
 * or at the least size.
 */
export function dragged(start: Box, grip: Grip, dx: number, dy: number, area: Area): Box {
  if (grip === 'move') return fitted({ ...start, x: start.x + dx, y: start.y + dy }, area);
  const small = least(area);
  let left = start.x;
  let top = start.y;
  let right = start.x + start.w;
  let bottom = start.y + start.h;
  for (const edge of EDGES[grip]) {
    if (edge === 'w') left = clamp(left + dx, MARGIN, right - small.w);
    if (edge === 'e') right = clamp(right + dx, left + small.w, area.w - MARGIN);
    if (edge === 'n') top = clamp(top + dy, MARGIN, bottom - small.h);
    if (edge === 's') bottom = clamp(bottom + dy, top + small.h, area.h - MARGIN);
  }
  return fitted({ x: left, y: top, w: right - left, h: bottom - top }, area);
}

/** A box as stored; null for nothing stored, or anything that isn't one. */
export function readBox(text: string | null): Box | null {
  let data: unknown;
  try {
    data = JSON.parse(text ?? 'null');
  } catch {
    return null;
  }
  if (typeof data !== 'object' || data === null) return null;
  const { x, y, w, h } = data as Record<string, unknown>;
  const numbers = [x, y, w, h].every((n) => typeof n === 'number' && Number.isFinite(n));
  return numbers ? ({ x, y, w, h } as Box) : null;
}
