import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { PAGE_MIN } from './pane-state';
import { BESIDE, COMPANION, SHARE, UNDER_PAGE } from './split-state';

describe('what each measure keeps, as stored', () => {
  it('reads what was kept, and takes anything else for even', () => {
    expect(SHARE.read('{"value":0.62}')).toBe(0.62);
    for (const text of [
      null,
      '',
      '{',
      'null',
      '[]',
      '{"value":"0.6"}',
      '{"value":0}',
      '{"value":1}',
    ])
      expect(SHARE.read(text)).toBe(SHARE.even);
    expect(SHARE.read('{"value":1e400}')).toBe(SHARE.even); // Infinity, written as a number too big
    expect(BESIDE.read('{"value":420}')).toBe(420);
    expect(BESIDE.read('{"value":120}')).toBe(COMPANION.width); // narrower than a companion can be
    expect(UNDER_PAGE.read('{"value":0.9}')).toBe(UNDER_PAGE.even);
  });
});

describe('two pages sharing the pane', () => {
  it('show the share remembered where both keep their least width, and give it back wider', () => {
    expect(SHARE.shown(0.9, 1000)).toBeCloseTo(1 - PAGE_MIN / 1000);
    expect(SHARE.shown(0.9, 4000)).toBe(0.9);
    expect(SHARE.shown(0.1, 1000)).toBeCloseTo(PAGE_MIN / 1000);
    expect(SHARE.shown(0.7, 600)).toBe(0.5); // too narrow for two: nothing to show
  });

  it('move by the pixels dragged, from where the divider is shown', () => {
    // Remembered at 0.9, shown at 0.64 in a 1000px pane: a drag left starts from what's seen.
    expect(SHARE.moved(0.9, 1000, -40)).toBeCloseTo(0.6);
    expect(SHARE.moved(0.5, 1000, 16)).toBeCloseTo(0.516);
  });

  it('never leave a page narrower than its least, however it’s dragged', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.integer({ min: 2 * PAGE_MIN, max: 6000 }),
        fc.double({ min: -1e5, max: 1e5, noNaN: true }),
        (share, room, by) => {
          const moved = SHARE.shown(SHARE.moved(share, room, by), room);
          expect(moved * room).toBeGreaterThanOrEqual(PAGE_MIN - 1e-6);
          expect((1 - moved) * room).toBeGreaterThanOrEqual(PAGE_MIN - 1e-6);
        },
      ),
    );
  });
});

describe('a companion beside the page', () => {
  it('keeps its own width as the window grows, the page taking the rest', () => {
    expect(BESIDE.shown(380, 1000)).toBeCloseTo(1 - 380 / 1000);
    expect(BESIDE.shown(380, 2000)).toBeCloseTo(1 - 380 / 2000);
  });

  it('narrows to the right, widens to the left, within its least and the page’s', () => {
    expect(BESIDE.moved(380, 1000, 40)).toBe(340);
    expect(BESIDE.moved(380, 1000, -40)).toBe(420);
    expect(BESIDE.moved(380, 1000, 500)).toBe(COMPANION.least);
    expect(BESIDE.moved(380, 1000, -500)).toBe(1000 - COMPANION.page);
  });

  it('never leaves the page or itself under their least, however it’s dragged', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: COMPANION.least, max: 2000 }),
        fc.integer({ min: COMPANION.least + COMPANION.page, max: 6000 }),
        fc.double({ min: -1e5, max: 1e5, noNaN: true }),
        (width, room, by) => {
          const share = BESIDE.shown(BESIDE.moved(width, room, by), room);
          expect((1 - share) * room).toBeGreaterThanOrEqual(COMPANION.least - 1e-6);
          expect(share * room).toBeGreaterThanOrEqual(COMPANION.page - 1e-6);
        },
      ),
    );
  });
});

describe('a companion with less room than it and the page need (Two pages when narrow)', () => {
  it('halves the room with the page, and keeps its width for when there’s room again', () => {
    for (const room of [240, 520, 590, COMPANION.least + COMPANION.page - 1])
      expect(BESIDE.shown(380, room), String(room)).toBe(0.5);
    expect(BESIDE.moved(380, 590, 40)).toBe(380);
  });
});

describe('a companion under the page', () => {
  it('takes its share of the height, from a quarter to seven tenths', () => {
    expect(UNDER_PAGE.shown(UNDER_PAGE.even, 800)).toBeCloseTo(0.58);
    expect(UNDER_PAGE.moved(0.42, 800, 80)).toBeCloseTo(0.32); // down: the companion shorter
    expect(UNDER_PAGE.moved(0.42, 800, 800)).toBe(0.25);
    expect(UNDER_PAGE.moved(0.42, 800, -800)).toBe(0.7);
  });
});
