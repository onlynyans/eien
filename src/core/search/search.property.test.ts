// Properties of search over generated text: folding a character at a time
// gives the whole text's length (how a match is traced back to where it
// was), and a snippet never cuts a character in half.

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { fold, queryTerms, snippet } from './search';

/** Characters folding changes: case, accents, ligatures, final sigma, full width, quotes, emoji. */
const tricky = fc.constantFrom(
  'Σ',
  'ς',
  'İ',
  'ß',
  'ẞ',
  'ﬃ',
  'Å',
  'e\u0301',
  '́',
  'Ａ',
  '①',
  '’',
  '“',
  '„',
  '한',
  '🧣',
  '👩🏽\u200D💻',
  '\uD83E', // half of 🧣
  ' ',
  '\n',
);
const text = fc.oneof(
  fc.string({ unit: 'binary', maxLength: 60 }),
  fc.array(fc.oneof(tricky, fc.string({ maxLength: 4 })), { maxLength: 40 }).map((p) => p.join('')),
);

/** Text with no spaces (Japanese, a run of emoji), where a snippet's cuts fall mid-word. */
const unspaced = fc
  .array(fc.constantFrom('永', '遠', 'り', '🧣', '👩🏽\u200D💻', '𝒜', 'a'), {
    maxLength: 300,
    size: 'max',
  })
  .map((p) => p.join(''));

describe('fold', () => {
  it('folds a text to the length of its characters folded one at a time', () => {
    fc.assert(
      fc.property(text, (t) => {
        const each = [...t].reduce((sum, char) => sum + fold(char).length, 0);
        expect(fold(t).length).toBe(each);
      }),
    );
  });
});

describe('snippet', () => {
  /** A note's words (whole characters only) and a query: often words from it, so it matches. */
  const plainAndQuery = fc
    .oneof(text, unspaced)
    .map((t) => t.toWellFormed())
    .chain((plain) =>
      fc.tuple(
        fc.constant(plain),
        fc.oneof(
          text,
          fc
            .tuple(fc.nat(plain.length), fc.integer({ min: 1, max: 12 }))
            .map(([at, length]) => plain.slice(at, at + length)),
        ),
      ),
    );

  it('never cuts a surrogate pair in half', () => {
    fc.assert(
      fc.property(plainAndQuery, ([plain, query]) => {
        expect(snippet(plain, queryTerms(query)).isWellFormed()).toBe(true);
      }),
    );
  });
});
