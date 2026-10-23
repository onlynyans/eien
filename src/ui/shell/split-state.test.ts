import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { PAGE_MIN } from './pane-state';
import { EVEN, movedShare, readShare, shownShare, twoFit } from './split-state';

describe('the divider’s share, as stored', () => {
  it('reads what was kept, and takes anything else for even', () => {
    expect(readShare('{"share":0.62}')).toBe(0.62);
    for (const text of [
      null,
      '',
      '{',
      'null',
      '[]',
      '{"share":"0.6"}',
      '{"share":0}',
      '{"share":1}',
    ])
      expect(readShare(text)).toBe(EVEN);
    expect(readShare('{"share":-0.2}')).toBe(EVEN);
    expect(readShare('{"share":1e400}')).toBe(EVEN); // Infinity, written as a number too big
  });
});

describe('two pages in the pane', () => {
  it('fit from two pages’ least width, and fold below it', () => {
    expect(twoFit(2 * PAGE_MIN)).toBe(true);
    expect(twoFit(2 * PAGE_MIN - 1)).toBe(false);
    expect(twoFit(Number.NaN)).toBe(false);
  });

  it('show the share remembered where both pages keep their least width, and give it back wider', () => {
    expect(shownShare(0.9, 1000)).toBeCloseTo(1 - PAGE_MIN / 1000);
    expect(shownShare(0.9, 4000)).toBe(0.9);
    expect(shownShare(0.1, 1000)).toBeCloseTo(PAGE_MIN / 1000);
    expect(shownShare(0.7, 600)).toBe(EVEN); // folded: nothing to show
  });

  it('move by the pixels dragged, from where the divider is shown', () => {
    // Remembered at 0.9, shown at 0.64 in a 1000px pane: a drag left starts from what's seen.
    expect(movedShare(0.9, 1000, -40)).toBeCloseTo(0.6);
    expect(movedShare(0.5, 1000, 16)).toBeCloseTo(0.516);
  });

  it('never leaves a page narrower than its least, however it’s dragged', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.integer({ min: 2 * PAGE_MIN, max: 6000 }),
        fc.double({ min: -1e5, max: 1e5, noNaN: true }),
        (share, width, by) => {
          const moved = movedShare(share, width, by);
          expect(moved * width).toBeGreaterThanOrEqual(PAGE_MIN - 1e-6);
          expect((1 - moved) * width).toBeGreaterThanOrEqual(PAGE_MIN - 1e-6);
        },
      ),
    );
  });
});
