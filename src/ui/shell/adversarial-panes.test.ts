// Adversarial: the panes' arithmetic (phase 6c) against hostile stored values
// and every window width, including ones no window has.

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PANES,
  type Edge,
  LIMITS,
  PAGE_MIN,
  type Panes,
  readPanes,
  resized,
  STEP,
  shownWidths,
  sidebarEdge,
} from './pane-state';

const EDGES: readonly Edge[] = ['sidebar', 'sidebarTwo', 'list'];

describe('readPanes, against what a hand, another build or a broken disk left', () => {
  it('reads -0, the smallest and largest doubles, and halves at the limits as whole, in-range pixels', () => {
    const cases: [string, number][] = [
      ['-0', LIMITS.sidebar[0]],
      ['5e-324', LIMITS.sidebar[0]],
      ['1.7976931348623157e308', LIMITS.sidebar[1]],
      ['419.5', LIMITS.sidebar[1]],
      ['199.5', LIMITS.sidebar[0]],
      ['300.5', 301],
      ['300.49999', 300],
    ];
    for (const [value, width] of cases) {
      const panes = readPanes(`{"sidebar": ${value}}`);
      expect(panes.sidebar, value).toBe(width);
      expect(Number.isInteger(panes.sidebar), value).toBe(true);
      expect(Object.is(panes.sidebar, -0), value).toBe(false);
    }
  });

  it('takes no width from a string, a boolean or an object that only looks like a number', () => {
    for (const value of [
      '"300"',
      '"300px"',
      'true',
      '{"valueOf": 300}',
      '[300]',
      '"NaN"',
      '"Infinity"',
    ]) {
      expect(readPanes(`{"list": ${value}}`).list, value).toBe(DEFAULT_PANES.list);
    }
  });

  it('shuts nothing on a flag that is merely truthy', () => {
    for (const value of ['1', '"true"', '"yes"', '{}', '[]', '"false"']) {
      const panes = readPanes(`{"sidebarShut": ${value}, "listShut": ${value}}`);
      expect(panes.sidebarShut, value).toBe(false);
      expect(panes.listShut, value).toBe(false);
    }
  });

  it('reads the last of a key written twice, as JSON does, and ignores a byte-order mark as garbage', () => {
    expect(readPanes('{"list": 300, "list": 400}').list).toBe(400);
    expect(readPanes('﻿{"list": 400}')).toEqual(DEFAULT_PANES);
    expect(readPanes('  {"list": 400}\n')).toMatchObject({ list: 400 });
  });

  it('survives a huge stored value without throwing', () => {
    const big = `{"sidebar": 300, "junk": "${'x'.repeat(1_000_000)}"}`;
    expect(readPanes(big).sidebar).toBe(300);
    expect(readPanes(`${'['.repeat(10_000)}`)).toEqual(DEFAULT_PANES);
  });
});

describe('resized', () => {
  it('turns -0 and fractions into whole pixels within limits, and moves only its own edge', () => {
    for (const edge of EDGES) {
      const at = resized(DEFAULT_PANES, edge, -0)[edge];
      expect(at).toBe(LIMITS[edge][0]);
      expect(Object.is(at, -0)).toBe(false);
      const half = resized(DEFAULT_PANES, edge, LIMITS[edge][0] + 10.5);
      expect(half[edge]).toBe(LIMITS[edge][0] + 11);
      for (const other of EDGES.filter((e) => e !== edge)) {
        expect(half[other]).toBe(DEFAULT_PANES[other]);
      }
    }
  });

  it('ignores -Infinity as it does NaN and Infinity', () => {
    expect(resized(DEFAULT_PANES, 'list', Number.NEGATIVE_INFINITY)).toBe(DEFAULT_PANES);
  });

  it('keeps the shut flags as they were', () => {
    const shut: Panes = { ...DEFAULT_PANES, sidebarShut: true, listShut: true };
    expect(resized(shut, 'sidebar', 300)).toMatchObject({ sidebarShut: true, listShut: true });
  });

  it('steps by STEP from anywhere between the limits and never overshoots them', () => {
    for (const edge of EDGES) {
      const [min, max] = LIMITS[edge];
      let panes = resized(DEFAULT_PANES, edge, min);
      for (let i = 0; i < 100; i++) panes = resized(panes, edge, panes[edge] + STEP);
      expect(panes[edge]).toBe(max);
      for (let i = 0; i < 100; i++) panes = resized(panes, edge, panes[edge] - STEP);
      expect(panes[edge]).toBe(min);
    }
  });
});

// A shut sidebar's strip: the seal alone's none, Running head's band, Band's and Slip's band.
describe.each([0, 48, 56])('shownWidths, at every window width, a shut sidebar %ipx', (STRIP) => {
  const stored: Panes[] = [
    DEFAULT_PANES,
    { ...DEFAULT_PANES, sidebar: 420, sidebarTwo: 520, list: 480 },
    { ...DEFAULT_PANES, sidebar: 200, sidebarTwo: 220, list: 260 },
    { ...DEFAULT_PANES, sidebarShut: true },
    { ...DEFAULT_PANES, listShut: true },
    { ...DEFAULT_PANES, sidebarShut: true, listShut: true, sidebarTwo: 520 },
  ];
  const windows = [
    Number.NEGATIVE_INFINITY,
    -1e9,
    -1,
    -0,
    0,
    1,
    47,
    48,
    300,
    639,
    640,
    700,
    820,
    900,
    1000,
    1264,
    1600,
    1e9,
  ];

  it('never shows NaN, a fraction, or a pane past its limits', () => {
    for (const panes of stored) {
      for (const two of [false, true]) {
        for (const window of [...windows, Number.NaN, Number.POSITIVE_INFINITY]) {
          const { sidebar, list } = shownWidths(panes, two, window, STRIP);
          const where = `${JSON.stringify(panes)} two=${two} window=${window}`;
          expect(Number.isInteger(sidebar), where).toBe(true);
          expect(Number.isInteger(list), where).toBe(true);
          const edge = sidebarEdge(two);
          if (panes.sidebarShut) expect(sidebar, where).toBe(STRIP);
          else {
            expect(sidebar, where).toBeGreaterThanOrEqual(LIMITS[edge][0]);
            expect(sidebar, where).toBeLessThanOrEqual(panes[edge]);
          }
          if (two || panes.listShut) expect(list, where).toBe(0);
          else {
            expect(list, where).toBeGreaterThanOrEqual(LIMITS.list[0]);
            expect(list, where).toBeLessThanOrEqual(panes.list);
          }
        }
      }
    }
  });

  it('never narrows a pane as the window widens', () => {
    for (const panes of stored) {
      for (const two of [false, true]) {
        let before = shownWidths(panes, two, windows[0] as number, STRIP);
        for (const window of windows.slice(1)) {
          const now = shownWidths(panes, two, window, STRIP);
          const where = `${JSON.stringify(panes)} two=${two} window=${window}`;
          expect(now.sidebar, where).toBeGreaterThanOrEqual(before.sidebar);
          expect(now.list, where).toBeGreaterThanOrEqual(before.list);
          before = now;
        }
      }
    }
  });

  it('leaves the page PAGE_MIN whenever the narrowest panes allow it', () => {
    for (const panes of stored) {
      for (const two of [false, true]) {
        const edge = sidebarEdge(two);
        const narrowest =
          (panes.sidebarShut ? STRIP : LIMITS[edge][0]) +
          (two || panes.listShut ? 0 : LIMITS.list[0]);
        for (let window = narrowest + PAGE_MIN; window <= 2000; window += 7) {
          const { sidebar, list } = shownWidths(panes, two, window, STRIP);
          expect(window - sidebar - list, `${JSON.stringify(panes)} two=${two} ${window}`).toBe(
            Math.max(
              PAGE_MIN,
              window -
                (panes.sidebarShut ? STRIP : panes[edge]) -
                (two || panes.listShut ? 0 : panes.list),
            ),
          );
        }
      }
    }
  });

  it('two panes, the sidebar shut, the tiniest window: the strip alone', () => {
    const shut = { ...DEFAULT_PANES, sidebarShut: true };
    for (const window of [0, 1, STRIP, 100]) {
      expect(shownWidths(shut, true, window, STRIP)).toEqual({ sidebar: STRIP, list: 0 });
    }
  });

  it('a window with no width (NaN, as a detached window reports) shows the remembered widths', () => {
    expect(shownWidths(DEFAULT_PANES, false, Number.NaN, STRIP)).toEqual({
      sidebar: 264,
      list: 316,
    });
  });
});
