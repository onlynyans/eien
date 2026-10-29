// What holds for any chapter's text (#40, Phase 2): a place comes back to
// the same offset, clamped to the words there are.

import fc from 'fast-check';
import { describe, it } from 'vitest';
import { offsetOf, spotOf } from './place';

describe('a place in a chapter', () => {
  it('comes back to the same offset, for any text and any place in it', () => {
    fc.assert(
      fc.property(
        fc.array(fc.nat({ max: 400 }), { maxLength: 60 }),
        fc.nat({ max: 30_000 }),
        (lengths, wanted) => {
          const total = lengths.reduce((sum, length) => sum + length, 0);
          const spot = spotOf(lengths, wanted);
          if (total === 0) return spot === null;
          return spot !== null && offsetOf(lengths, spot) === Math.min(wanted, total);
        },
      ),
    );
  });
});
