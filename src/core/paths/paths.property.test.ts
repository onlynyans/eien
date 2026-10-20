// Properties of names over generated input: what safeName makes is always a
// name every system can store, and a free name never collides with one taken.

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { freeNoteName, nameKey, nameProblems, safeName } from './index';
import { MAX_NAME_BYTES, utf8Length } from './names';

/** Pieces that trip name rules: reserved words, forbidden characters, dots, spaces, case pairs. */
const piece = fc.constantFrom(
  'con',
  'AUX',
  'com1',
  'lpt¹',
  'nul',
  '.',
  '..',
  ' ',
  '\t',
  ':',
  '/',
  '\\',
  '?',
  '"',
  '\u0000',
  '\u007f',
  'Straße',
  'STRASSE',
  'Café',
  'Cafe\u0301',
  'ς',
  'Σ',
  'ſ',
  '🧣',
  '\uD83E', // half of 🧣
  '永遠',
  '.md',
  ' 2',
);
/** Anything typed or pasted: pieces, any UTF-16 (lone surrogates too), or long runs. */
const typed = fc.oneof(
  fc.array(piece, { maxLength: 8 }).map((p) => p.join('')),
  fc.string({ unit: 'binary', maxLength: 40 }),
  fc
    .tuple(fc.array(piece, { maxLength: 3 }), fc.constantFrom('a', 'é', '永', '🧣'), fc.nat(300))
    .map(([p, c, n]) => p.join('') + c.repeat(n)),
);

describe('safeName', () => {
  it('always gives a name nameProblems accepts, within the byte limit', () => {
    fc.assert(
      fc.property(typed, fc.integer({ min: 8, max: MAX_NAME_BYTES }), (input, maxBytes) => {
        const name = safeName(input, 'Untitled', maxBytes);
        expect(nameProblems(name)).toEqual([]);
        expect(utf8Length(name)).toBeLessThanOrEqual(maxBytes);
      }),
    );
  });
});

describe('freeNoteName', () => {
  const suffix = fc.constantFrom(
    '',
    ' (conflict 2026-10-19 16-40)',
    ' (recovered 2026-10-19 16-40)',
  );
  /** Names already in a folder, some of them the ones freeNoteName would pick. */
  const taken = (title: string, end: string) =>
    fc.array(
      fc.oneof(
        typed,
        fc.nat(4).map((n) => `${safeName(title)}${end}${n < 2 ? '' : ` ${n}`}.md`),
        fc.nat(4).map((n) => `${safeName(title).toUpperCase()}${end}${n < 2 ? '' : ` ${n}`}.MD`),
      ),
      { maxLength: 8 },
    );

  it('never gives a name equal, as the disk compares them, to one taken; and a valid one', () => {
    fc.assert(
      fc.property(
        typed.chain((title) =>
          suffix.chain((end) => taken(title, end).map((names) => ({ title, end, names }))),
        ),
        ({ title, end, names }) => {
          const name = freeNoteName(title, names, end);
          expect(names.map(nameKey)).not.toContain(nameKey(name));
          expect(nameProblems(name)).toEqual([]);
          expect(name.endsWith(`${end}.md`) || /\s\d+\.md$/.test(name)).toBe(true);
        },
      ),
    );
  });
});
