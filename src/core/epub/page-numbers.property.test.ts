// Over generated books: steady page numbers only rise through the book and
// never pass its last page, a page's start numbers as that page, and a
// place's page begins at or before it. Printed pages in the book's order
// only rise too.

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { type PrintAt, printAt, steadyAt, steadyPages, steadyStart } from './page-numbers';

const lengths = fc.array(fc.nat({ max: 20_000 }), { maxLength: 30 });

/** A book's lengths and two places in it, in order. */
const twoPlaces = lengths
  .filter((items) => items.length > 0)
  .chain((items) => {
    const place = fc
      .nat({ max: items.length - 1 })
      .chain((spine) => fc.tuple(fc.constant(spine), fc.nat({ max: (items[spine] ?? 0) + 10 })));
    return fc.tuple(fc.constant(items), place, place);
  });

const before = (a: readonly [number, number], b: readonly [number, number]) =>
  a[0] < b[0] || (a[0] === b[0] && a[1] <= b[1]);

/** How many of the book's characters stand before a place: an empty item's start is the next's. */
const charsBefore = (items: readonly number[], spine: number, offset: number) =>
  items.slice(0, spine).reduce((sum, length) => sum + length, 0) + offset;

describe('steady page numbers over any book', () => {
  it('only rise through the book, from 1, never past its last page', () => {
    fc.assert(
      fc.property(twoPlaces, ([items, a, b]) => {
        const [first, second] = before(a, b) ? [a, b] : [b, a];
        const one = steadyAt(items, ...first) as number;
        const two = steadyAt(items, ...second) as number;
        const pages = steadyPages(items) as number;
        expect(one).toBeGreaterThanOrEqual(1);
        expect(two).toBeGreaterThanOrEqual(one);
        expect(two).toBeLessThanOrEqual(pages);
      }),
    );
  });

  it('number each page’s start as that page', () => {
    fc.assert(
      fc.property(
        lengths.chain((items) =>
          fc.tuple(fc.constant(items), fc.integer({ min: 1, max: steadyPages(items) ?? 1 })),
        ),
        ([items, page]) => {
          const start = steadyStart(items, page);
          expect(start).not.toBeNull();
          if (!start || items.length === 0) return;
          expect(steadyAt(items, start.spine, start.offset)).toBe(page);
        },
      ),
    );
  });

  it('put a place’s page’s start at or before it', () => {
    fc.assert(
      fc.property(twoPlaces, ([items, [spine, offset]]) => {
        const within = Math.min(offset, items[spine] ?? 0);
        const start = steadyStart(items, steadyAt(items, spine, within) as number);
        expect(start).not.toBeNull();
        if (start)
          expect(charsBefore(items, start.spine, start.offset)).toBeLessThanOrEqual(
            charsBefore(items, spine, within),
          );
      }),
    );
  });
});

describe('printed pages in the book’s order', () => {
  it('only rise through the book', () => {
    // Pages laid in order: each item's at rising offsets, some lost (null).
    const book = fc
      .array(fc.array(fc.option(fc.nat({ max: 100 }), { nil: null }), { maxLength: 4 }), {
        minLength: 1,
        maxLength: 6,
      })
      .map((items) => {
        let n = 0;
        return items.flatMap((offsets, spine) =>
          [...offsets]
            .sort((x, y) => (x ?? 0) - (y ?? 0))
            .map((offset): PrintAt => ({ label: String(++n), spine, offset })),
        );
      });
    const place = fc.tuple(fc.nat({ max: 6 }), fc.nat({ max: 120 }));
    fc.assert(
      fc.property(book, place, place, (pages, a, b) => {
        const [first, second] = before(a, b) ? [a, b] : [b, a];
        const one = printAt(pages, ...first);
        const two = printAt(pages, ...second);
        if (one !== null) expect(Number(two)).toBeGreaterThanOrEqual(Number(one));
      }),
    );
  });
});
