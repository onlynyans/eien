// Settings' box: moved by its head, resized by its edges and corners, inside
// the window and never smaller than 560 × 380.

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  type Area,
  type Box,
  dragged,
  firstBox,
  fitted,
  GRIPS,
  type Grip,
  MARGIN,
  MIN_H,
  MIN_W,
  readBox,
} from './box';

const WINDOW: Area = { w: 1200, h: 800 };
const START: Box = { x: 200, y: 100, w: 700, h: 500 };

describe('where it first opens', () => {
  it('at the inset, 64px above and below and 112px at the sides', () => {
    expect(firstBox(WINDOW)).toEqual({ x: 112, y: 64, w: 976, h: 672 });
  });

  it('no smaller than it can be used, in a small window', () => {
    expect(firstBox({ w: 700, h: 500 })).toEqual({ x: 70, y: 60, w: 560, h: 380 });
  });
});

describe('a move', () => {
  it('moves it and never resizes it: "move" holds an "e"', () => {
    expect(dragged(START, 'move', 50, -20, WINDOW)).toEqual({ ...START, x: 250, y: 80 });
  });

  it('stops at the window’s edge, at the same size', () => {
    expect(dragged(START, 'move', 2000, 2000, WINDOW)).toEqual({
      x: WINDOW.w - MARGIN - START.w,
      y: WINDOW.h - MARGIN - START.h,
      w: START.w,
      h: START.h,
    });
    expect(dragged(START, 'move', -2000, -2000, WINDOW)).toMatchObject({ x: MARGIN, y: MARGIN });
  });
});

describe('a resize', () => {
  const cases: [Grip, number, number, Box][] = [
    ['e', 40, 30, { ...START, w: 740 }],
    ['s', 40, 30, { ...START, h: 530 }],
    ['se', 40, 30, { ...START, w: 740, h: 530 }],
    ['w', 40, 30, { ...START, x: 240, w: 660 }],
    ['n', 40, 30, { ...START, y: 130, h: 470 }],
    ['nw', -40, -30, { x: 160, y: 70, w: 740, h: 530 }],
    ['ne', 40, -30, { ...START, y: 70, w: 740, h: 530 }],
    ['sw', -40, 30, { ...START, x: 160, w: 740, h: 530 }],
  ];
  it.each(cases)('by %s moves only its edges', (grip, dx, dy, after) => {
    expect(dragged(START, grip, dx, dy, WINDOW)).toEqual(after);
  });

  it('stops at the least size, the far edge staying put', () => {
    expect(dragged(START, 'w', 600, 0, WINDOW)).toEqual({ ...START, x: 340, w: MIN_W });
    expect(dragged(START, 'n', 0, 600, WINDOW)).toEqual({ ...START, y: 220, h: MIN_H });
    expect(dragged(START, 'se', -600, -600, WINDOW)).toEqual({ ...START, w: MIN_W, h: MIN_H });
  });

  it('stops at the window’s edge', () => {
    expect(dragged(START, 'se', 2000, 2000, WINDOW)).toEqual({
      ...START,
      w: WINDOW.w - MARGIN - START.x,
      h: WINDOW.h - MARGIN - START.y,
    });
    expect(dragged(START, 'nw', -2000, -2000, WINDOW)).toEqual({
      x: MARGIN,
      y: MARGIN,
      w: START.x + START.w - MARGIN,
      h: START.y + START.h - MARGIN,
    });
  });
});

describe('any drag', () => {
  it('leaves it inside the window and at least its least size', () => {
    const area = fc.record({
      w: fc.integer({ min: 600, max: 3000 }),
      h: fc.integer({ min: 420, max: 2000 }),
    });
    fc.assert(
      fc.property(
        area,
        fc.constantFrom<Grip>('move', ...GRIPS),
        fc.integer({ min: -4000, max: 4000 }),
        fc.integer({ min: -4000, max: 4000 }),
        (window, grip, dx, dy) => {
          const box = dragged(firstBox(window), grip, dx, dy, window);
          expect(box.x).toBeGreaterThanOrEqual(MARGIN);
          expect(box.y).toBeGreaterThanOrEqual(MARGIN);
          expect(box.x + box.w).toBeLessThanOrEqual(window.w - MARGIN);
          expect(box.y + box.h).toBeLessThanOrEqual(window.h - MARGIN);
          expect(box.w).toBeGreaterThanOrEqual(Math.min(MIN_W, window.w - 2 * MARGIN));
          expect(box.h).toBeGreaterThanOrEqual(Math.min(MIN_H, window.h - 2 * MARGIN));
          if (grip === 'move')
            expect([box.w, box.h]).toEqual([firstBox(window).w, firstBox(window).h]);
        },
      ),
    );
  });
});

describe('a box kept on this device', () => {
  it('is fitted to a window smaller than the one it was kept in', () => {
    expect(fitted({ x: 900, y: 600, w: 900, h: 700 }, { w: 1000, h: 640 })).toEqual({
      x: 92,
      y: 8,
      w: 900,
      h: 624,
    });
  });

  it('reads back, and anything that isn’t one is none', () => {
    expect(readBox(JSON.stringify(START))).toEqual(START);
    for (const bad of [null, '', '{', '[]', '{"x":1}', '{"x":"1","y":2,"w":3,"h":4}', 'null']) {
      expect(readBox(bad), String(bad)).toBeNull();
    }
  });
});
