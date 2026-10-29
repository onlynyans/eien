// What holds for any book (#40, Phase 2): how far through is between 0 and
// 1, and never falls as you read on through the reading order.

import fc from 'fast-check';
import { describe, it } from 'vitest';
import { bookFraction } from './progress';

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
