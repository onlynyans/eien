import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { evenRows, mixedRows, OVERSCAN, revealTop, windowRange } from './window-range';

const view = (scrollTop: number, height = 600, offset = 0) => ({ scrollTop, height, offset });

describe('windowRange', () => {
  it('draws the rows in sight and a few either side', () => {
    // 30px rows, 600px of view, scrolled to row 100.
    expect(windowRange(evenRows(3000, 30), view(3000))).toEqual({
      first: 100 - OVERSCAN,
      last: 120 + OVERSCAN,
    });
  });

  it('at the top, starts at the first row; at the end, stops at the last', () => {
    expect(windowRange(evenRows(3000, 30), view(0)).first).toBe(0);
    expect(windowRange(evenRows(3000, 30), view(3000 * 30 - 600)).last).toBe(3000);
  });

  it('counts from where the list starts in the scroller, below the rows above it', () => {
    // The list starts 900px down (folders, a section's head): scrolled to 900, its first row shows.
    expect(windowRange(evenRows(3000, 30), view(900, 600, 900)).first).toBe(0);
    expect(windowRange(evenRows(3000, 30), view(900 + 3000, 600, 900)).first).toBe(100 - OVERSCAN);
  });

  it('a list scrolled out of sight still draws a few rows at its nearer end', () => {
    // Above the view (scrolled past it), and below it (not reached yet): never empty.
    const past = windowRange(evenRows(300, 30), view(50_000, 600, 0));
    expect(past.last).toBe(300);
    expect(past.last - past.first).toBeGreaterThan(0);
    const before = windowRange(evenRows(300, 30), view(0, 600, 20_000));
    expect(before.first).toBe(0);
    expect(before.last - before.first).toBeGreaterThan(0);
  });

  it('draws nothing for no rows, and every row of a short list in sight', () => {
    expect(windowRange(evenRows(0, 30), view(0))).toEqual({ first: 0, last: 0 });
    expect(windowRange(evenRows(5, 30), view(0))).toEqual({ first: 0, last: 5 });
  });

  it('property: every row in sight is drawn, and never many more than fit', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 50_000 }),
        fc.integer({ min: 10, max: 120 }),
        fc.integer({ min: 0, max: 3_000_000 }),
        fc.integer({ min: 100, max: 2000 }),
        fc.integer({ min: 0, max: 5000 }),
        (count, rowHeight, scrollTop, height, offset) => {
          const { first, last } = windowRange(evenRows(count, rowHeight), {
            scrollTop,
            height,
            offset,
          });
          expect(first).toBeGreaterThanOrEqual(0);
          expect(last).toBeLessThanOrEqual(count);
          expect(last).toBeGreaterThan(first);
          // The rows whose pixels meet the view are all within the range.
          const top = scrollTop - offset;
          const firstSeen = Math.max(Math.floor(top / rowHeight), 0);
          const lastSeen = Math.min(Math.ceil((top + height) / rowHeight), count);
          if (firstSeen < lastSeen) {
            expect(first).toBeLessThanOrEqual(firstSeen);
            expect(last).toBeGreaterThanOrEqual(lastSeen);
          }
          expect(last - first).toBeLessThanOrEqual(
            Math.ceil(height / rowHeight) + 2 * OVERSCAN + 2,
          );
        },
      ),
    );
  });
});

describe('revealTop', () => {
  it('leaves a row in sight where it is', () => {
    expect(revealTop(evenRows(3000, 30), 105, view(3000))).toBe(3000);
  });

  it('scrolls up just enough for a row above, down just enough for one below', () => {
    expect(revealTop(evenRows(3000, 30), 50, view(3000))).toBe(1500);
    expect(revealTop(evenRows(3000, 30), 200, view(3000))).toBe(200 * 30 + 30 - 600);
  });

  it('counts the list’s offset in the scroller', () => {
    expect(revealTop(evenRows(3000, 30), 0, view(5000, 600, 900))).toBe(900);
  });
});

describe('mixedRows', () => {
  // Group heads 40px tall among 64px rows: a head, three rows, a head, three rows.
  const heights = [40, 64, 64, 64, 40, 64, 64, 64];
  const rows = mixedRows(heights);

  it('lays the rows one after another', () => {
    expect([0, 1, 4, 5, 8].map((at) => rows.top(at))).toEqual([0, 40, 232, 272, 464]);
  });

  it('finds the row a point falls in, and how many start above it', () => {
    expect(rows.firstAt(0)).toBe(0);
    expect(rows.firstAt(39)).toBe(0);
    expect(rows.firstAt(40)).toBe(1);
    expect(rows.firstAt(250)).toBe(4);
    expect(rows.endAt(40)).toBe(1);
    expect(rows.endAt(41)).toBe(2);
    expect(rows.endAt(10_000)).toBe(8);
  });

  it('reveals a row by its own top and foot', () => {
    expect(revealTop(rows, 5, view(0, 100))).toBe(336 - 100);
    expect(revealTop(rows, 4, view(300, 100))).toBe(232);
  });

  it('property: every row in sight is drawn, whatever the heights', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 10, max: 120 }), { minLength: 1, maxLength: 3000 }),
        fc.integer({ min: 0, max: 400_000 }),
        fc.integer({ min: 100, max: 2000 }),
        (sizes, scrollTop, height) => {
          const rows = mixedRows(sizes);
          const { first, last } = windowRange(rows, { scrollTop, height, offset: 0 });
          expect(first).toBeGreaterThanOrEqual(0);
          expect(last).toBeLessThanOrEqual(sizes.length);
          expect(last).toBeGreaterThan(first);
          for (let at = 0; at < sizes.length; at++) {
            const seen = rows.top(at + 1) > scrollTop && rows.top(at) < scrollTop + height;
            if (seen) expect(at >= first && at < last).toBe(true);
          }
        },
      ),
    );
  });
});
