// What holds for any book (#40, Phase 2): how far through is between 0 and
// 1, and never falls as you read on through the reading order.

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { bookFraction, placeAt } from './progress';

describe('how far through', () => {
  it('stays between 0 and 1, and never falls as you read on', () => {
    const at = fc.record({ index: fc.nat({ max: 30 }), within: fc.double({ min: 0, max: 1 }) });
    fc.assert(
      fc.property(
        fc.array(fc.record({ size: fc.nat({ max: 10_000 }), linear: fc.boolean() }), {
          maxLength: 30,
        }),
        at,
        at,
        (items, a, b) => {
          const fa = bookFraction(items, a.index, a.within);
          const fb = bookFraction(items, b.index, b.within);
          const later = b.index > a.index || (b.index === a.index && b.within >= a.within);
          const linear = (i: number) => items[i]?.linear !== false;
          if (fa < 0 || fa > 1 || fb < 0 || fb > 1) return false;
          return !(later && linear(a.index) && linear(b.index)) || fb >= fa - 1e-12;
        },
      ),
    );
  });
});

describe('a share of the book, and back (Phase 4d)', () => {
  const book = fc.array(fc.record({ size: fc.nat({ max: 10_000 }), linear: fc.boolean() }), {
    maxLength: 30,
  });

  it('finds the place a share of the book is, which is that share again', () => {
    fc.assert(
      fc.property(book, fc.double({ min: 0, max: 1, noNaN: true }), (items, fraction) => {
        const place = placeAt(items, fraction);
        const total = items.reduce((sum, item) => sum + (item.linear ? item.size : 0), 0);
        if (!place || total === 0) return;
        expect(items[place.index]?.linear).toBe(true);
        expect(place.within).toBeGreaterThanOrEqual(0);
        expect(place.within).toBeLessThanOrEqual(1);
        expect(bookFraction(items, place.index, place.within)).toBeCloseTo(fraction, 9);
      }),
    );
  });
});

// QA (Phase 4d): the strip goes both ways. A place taken to a share and back
// must be the same place, or a bookmark's tab and a click on it would part;
// and a hand drawn down the strip must never move back through the book.
describe('a place in the book, as a share and back (Phase 4d, QA)', () => {
  const book = fc.array(fc.record({ size: fc.nat({ max: 10_000 }), linear: fc.boolean() }), {
    minLength: 1,
    maxLength: 30,
  });

  it('is the same chapter and the same way into it, for a chapter with words in the reading order', () => {
    fc.assert(
      fc.property(
        book,
        fc.nat(),
        // Short of its end: a chapter's end is the next one's start, by design.
        fc.double({ min: 0, max: 0.99, noNaN: true }),
        (items, pick, within) => {
          const index = pick % items.length;
          const item = items[index];
          if (!item?.linear || item.size === 0) return;
          const place = placeAt(items, bookFraction(items, index, within));
          expect(place?.index).toBe(index);
          expect(place?.within).toBeCloseTo(within, 6);
        },
      ),
    );
  });

  // The strip's ends and its chapters' starts are where a share falls between chapters.
  const share = fc.oneof(
    fc.constant(0),
    fc.constant(1),
    fc.double({ min: 0, max: 1, noNaN: true }),
  );

  it('never moves back through the book as the share grows, nor lands where there are no words', () => {
    fc.assert(
      fc.property(book, share, share, (items, a, b) => {
        const [low, high] = a <= b ? [a, b] : [b, a];
        const from = placeAt(items, low);
        const to = placeAt(items, high);
        if (!from || !to) return;
        expect(to.index > from.index || (to.index === from.index && to.within >= from.within)).toBe(
          true,
        );
        // A book with words lands on words; one with none, on its last chapter in the order.
        if (items.some((item) => item.linear && item.size > 0)) {
          expect(items[from.index]?.size).toBeGreaterThan(0);
          expect(items[to.index]?.size).toBeGreaterThan(0);
        }
      }),
    );
  });

  it('is nowhere for a book with nothing in its reading order, whatever the share', () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({ size: fc.nat({ max: 10_000 }), linear: fc.constant(false) }), {
          maxLength: 10,
        }),
        fc.double(),
        (items, fraction) => {
          expect(placeAt(items, fraction)).toBeNull();
        },
      ),
    );
  });
});
