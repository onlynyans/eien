// Over generated books: a place in a book with no printed pages is named by
// how far through the book it is (#67), which only rises through the book,
// from 0% to 100%, and is named only once its own chapter is counted.
// Printed pages in the book's order only rise too.

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { type PrintAt, placeLabel, printAt, shareAt } from './page-numbers';

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

/** A spine of `items.length` chapters, each in the reading order or not, of any size. */
const spineFor = (items: readonly unknown[]) =>
  fc.array(fc.record({ linear: fc.boolean(), size: fc.nat({ max: 50_000 }) }), {
    minLength: items.length,
    maxLength: items.length,
  });

describe('how far through a book a place is (#67)', () => {
  it('only rises through the book, from 0% to 100%', () => {
    fc.assert(
      fc.property(
        twoPlaces.chain((book) => fc.tuple(fc.constant(book), spineFor(book[0]))),
        ([[items, a, b], spine]) => {
          const [first, second] = before(a, b) ? [a, b] : [b, a];
          const one = shareAt(spine, items, ...first) as number;
          const two = shareAt(spine, items, ...second) as number;
          expect(one).toBeGreaterThanOrEqual(0);
          expect(two).toBeGreaterThanOrEqual(one - 1e-12);
          expect(two).toBeLessThanOrEqual(1);
          const label = placeLabel({ lengths: items, print: [] }, spine, ...second);
          expect(label).toMatch(/^(\d|[1-9]\d|100)%$/u);
        },
      ),
    );
  });

  it('is named once its own chapter is counted, whatever else is, and never before', () => {
    fc.assert(
      fc.property(
        twoPlaces.chain(([items, place]) =>
          fc.tuple(
            fc.constant(items),
            fc.constant(place),
            fc.array(fc.boolean(), { minLength: items.length, maxLength: items.length }),
            spineFor(items),
          ),
        ),
        ([items, [index, offset], counted, spine]) => {
          const lengths = items.map((length, i) => (counted[i] ? length : null));
          const label = placeLabel({ lengths, print: [] }, spine, index, offset);
          expect(label === null).toBe(!counted[index]);
        },
      ),
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

describe('a printed page lost from its chapter', () => {
  it('is never named for a place in that chapter', () => {
    // Pages in order, each label its own; some lost (null) from their chapter.
    const book = fc
      .array(fc.array(fc.option(fc.nat({ max: 100 }), { nil: null }), { maxLength: 4 }), {
        minLength: 1,
        maxLength: 6,
      })
      .map((items) => {
        let n = 0;
        return items.flatMap((offsets, spine) =>
          offsets.map((offset): PrintAt => ({ label: `p${++n}`, spine, offset })),
        );
      });
    fc.assert(
      fc.property(book, fc.nat({ max: 6 }), fc.nat({ max: 120 }), (pages, spine, offset) => {
        const lost = new Set(
          pages.filter((page) => page.spine === spine && page.offset === null).map((p) => p.label),
        );
        const named = printAt(pages, spine, offset);
        if (named !== null) expect(lost.has(named)).toBe(false);
      }),
    );
  });
});
