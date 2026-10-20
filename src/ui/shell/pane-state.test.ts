import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PANES,
  LIMITS,
  PAGE_MIN,
  type Panes,
  readPanes,
  resized,
  STEP,
  STRIP,
  shownWidths,
} from './pane-state';

describe('readPanes', () => {
  it('gives the defaults for nothing stored, or what isn’t an object of panes', () => {
    for (const text of [null, '', 'not json', '{', 'null', '42', '"wide"', '[300, 300]', 'true']) {
      expect(readPanes(text), String(text)).toEqual(DEFAULT_PANES);
    }
  });

  it('keeps what was stored', () => {
    const panes: Panes = {
      sidebar: 300,
      sidebarTwo: 400,
      list: 350,
      sidebarShut: true,
      listShut: false,
    };
    expect(readPanes(JSON.stringify(panes))).toEqual(panes);
  });

  it('takes each value on its own: a bad one is the default, the others are kept', () => {
    expect(readPanes('{"sidebar": "300px", "list": 350, "listShut": "yes"}')).toEqual({
      ...DEFAULT_PANES,
      list: 350,
    });
  });

  it('never takes a width that isn’t a finite number', () => {
    // JSON has no NaN or Infinity, but 1e999 reads as Infinity, and a hand-edited file may hold anything.
    for (const value of ['1e999', '-1e999', 'null', '[]', '{}', 'true']) {
      expect(readPanes(`{"sidebar": ${value}}`).sidebar, value).toBe(DEFAULT_PANES.sidebar);
    }
  });

  it('holds a width within its limits, in whole pixels', () => {
    expect(readPanes('{"sidebar": 5, "list": 99999, "sidebarTwo": -40}')).toMatchObject({
      sidebar: LIMITS.sidebar[0],
      list: LIMITS.list[1],
      sidebarTwo: LIMITS.sidebarTwo[0],
    });
    expect(readPanes('{"list": 300.6}').list).toBe(301);
  });

  it('ignores keys it doesn’t know, and an object’s own prototype tricks', () => {
    expect(readPanes('{"__proto__": {"sidebar": 400}, "constructor": 1, "zoom": 3}')).toEqual(
      DEFAULT_PANES,
    );
  });
});

describe('resized', () => {
  it('moves one edge, within its limits, and nothing else', () => {
    const wider = resized(DEFAULT_PANES, 'list', 400);
    expect(wider).toEqual({ ...DEFAULT_PANES, list: 400 });
    expect(resized(wider, 'list', 10).list).toBe(LIMITS.list[0]);
    expect(resized(wider, 'sidebarTwo', 10_000).sidebarTwo).toBe(LIMITS.sidebarTwo[1]);
  });

  it('ignores a width that isn’t a number (a pointer event with no position)', () => {
    expect(resized(DEFAULT_PANES, 'sidebar', Number.NaN)).toBe(DEFAULT_PANES);
    expect(resized(DEFAULT_PANES, 'sidebar', Number.POSITIVE_INFINITY)).toBe(DEFAULT_PANES);
  });

  it('steps from either limit back inside it', () => {
    const narrowest = resized(DEFAULT_PANES, 'sidebar', 0);
    expect(resized(narrowest, 'sidebar', narrowest.sidebar - STEP).sidebar).toBe(LIMITS.sidebar[0]);
    expect(resized(narrowest, 'sidebar', narrowest.sidebar + STEP).sidebar).toBe(
      LIMITS.sidebar[0] + STEP,
    );
  });
});

describe('shownWidths', () => {
  const wide = 1600;

  it('shows the remembered widths in a wide window', () => {
    expect(shownWidths(DEFAULT_PANES, false, wide)).toEqual({ sidebar: 264, list: 316 });
    expect(shownWidths(DEFAULT_PANES, true, wide)).toEqual({ sidebar: 312, list: 0 });
  });

  it('shows the strip for a shut sidebar, and nothing for a shut list', () => {
    const shut = { ...DEFAULT_PANES, sidebarShut: true, listShut: true };
    expect(shownWidths(shut, false, wide)).toEqual({ sidebar: STRIP, list: 0 });
    expect(shownWidths(shut, true, wide)).toEqual({ sidebar: STRIP, list: 0 });
  });

  it('has no list with two panes, whatever was remembered for it', () => {
    expect(shownWidths({ ...DEFAULT_PANES, listShut: false }, true, wide).list).toBe(0);
  });

  it('keeps the page PAGE_MIN wide by narrowing the list first, then the sidebar', () => {
    const panes = { ...DEFAULT_PANES, sidebar: 400, list: 450 };
    // 400 + 450 + 360 = 1210: in 1100, the list gives 110.
    expect(shownWidths(panes, false, 1100)).toEqual({ sidebar: 400, list: 340 });
    // In 900 the list is at its narrowest (260), and the sidebar gives the rest.
    expect(shownWidths(panes, false, 900)).toEqual({ sidebar: 280, list: 260 });
  });

  it('never narrows a pane past its narrowest, even in the smallest window', () => {
    // The window's own minimum is 640 wide (window.ts): the page gets what's left.
    const { sidebar, list } = shownWidths(DEFAULT_PANES, false, 640);
    expect(sidebar).toBe(LIMITS.sidebar[0]);
    expect(list).toBe(LIMITS.list[0]);
    for (const window of [0, -100, 1]) {
      expect(shownWidths(DEFAULT_PANES, false, window)).toEqual({
        sidebar: LIMITS.sidebar[0],
        list: LIMITS.list[0],
      });
    }
  });

  it('never narrows the strip', () => {
    const shut = { ...DEFAULT_PANES, sidebarShut: true };
    expect(shownWidths(shut, false, 300)).toEqual({ sidebar: STRIP, list: LIMITS.list[0] });
  });

  it('gives the panes back as the window widens again', () => {
    const panes = { ...DEFAULT_PANES, list: 480 };
    expect(shownWidths(panes, false, 800).list).toBeLessThan(480);
    expect(shownWidths(panes, false, 264 + 480 + PAGE_MIN)).toEqual({ sidebar: 264, list: 480 });
  });

  it('narrows the two-pane sidebar to its own narrowest', () => {
    const panes = { ...DEFAULT_PANES, sidebarTwo: 520 };
    expect(shownWidths(panes, true, 700)).toEqual({ sidebar: 340, list: 0 });
    expect(shownWidths(panes, true, 400)).toEqual({ sidebar: LIMITS.sidebarTwo[0], list: 0 });
  });
});

// That the defaults are the design's tokens (--eien-sidebar-w and the rest) is checked in the
// running window, where the tokens are computed: tests/e2e/panes.spec.ts.
describe('the defaults', () => {
  it('start every width inside its own limits', () => {
    for (const edge of ['sidebar', 'sidebarTwo', 'list'] as const) {
      expect(DEFAULT_PANES[edge]).toBeGreaterThanOrEqual(LIMITS[edge][0]);
      expect(DEFAULT_PANES[edge]).toBeLessThanOrEqual(LIMITS[edge][1]);
    }
  });
});
