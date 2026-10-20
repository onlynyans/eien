// Properties of the quotes over generated text: straightening what was
// curled gives back any text that had no curly quotes, and curling never
// changes anything but the quotes.

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { curlyQuotes, straightQuotes } from './quotes';

const piece = fc.constantFrom(
  '"',
  "'",
  ' ',
  'a',
  'B',
  '9',
  '.',
  ',',
  '—',
  '(',
  ')',
  '\n',
  '/',
  'tis',
  'n',
);
const text = fc.array(piece, { maxLength: 30 }).map((parts) => parts.join(''));

describe('quotes', () => {
  it('straightened after curling, a text without curly quotes is as it was', () => {
    fc.assert(
      fc.property(text, (t) => {
        expect(straightQuotes(curlyQuotes(t))).toBe(t);
      }),
    );
  });

  it('curling changes quotes only, one for one', () => {
    fc.assert(
      fc.property(text, (t) => {
        const curled = curlyQuotes(t);
        expect(curled.length).toBe(t.length);
        for (let i = 0; i < t.length; i++) {
          if (t[i] !== '"' && t[i] !== "'") expect(curled[i]).toBe(t[i]);
        }
      }),
    );
  });
});
