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
