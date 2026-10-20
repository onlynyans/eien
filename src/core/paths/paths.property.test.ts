// Properties of names over generated input: what safeName makes is always a
// name every system can store; a free name, a rename or a move never lands
// on a name another file in the folder has.

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  baseName,
  freeName,
  freeNoteName,
  joinPath,
  MAX_MADE_NAME_BYTES,
  MAX_NAME_BYTES,
  movedPath,
  nameKey,
  nameProblems,
  parentOf,
  renamedPath,
  safeName,
  titleOf,
  utf8Length,
} from './index';

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

/** Names already in a folder: anything, and some of the very names `base` would be given. */
const takenBy = (base: string, end: string) =>
  fc.array(
    fc.oneof(
      typed,
      fc.nat(4).map((n) => `${safeName(base)}${n < 2 ? '' : ` ${n}`}${end}`),
      fc
        .nat(4)
        .map((n) => `${safeName(base).toUpperCase()}${n < 2 ? '' : ` ${n}`}${end.toUpperCase()}`),
    ),
    { maxLength: 8 },
  );

/** A name a file or folder in the vault has (valid, as the disk lists only those). */
const existing = (extension: string) => typed.map((t) => safeName(t) + extension);

const keysOf = (names: readonly string[]) => names.map(nameKey);

describe('freeName and freeNoteName', () => {
  const suffix = fc.constantFrom(
    '',
    ' (conflict 2026-10-19 16-40)',
    ' (recovered 2026-10-19 16-40)',
  );
  const extension = fc.constantFrom('', '.md', '.MD', '.png');

  it('never give a name one taken has, as the disk compares them; always a valid one', () => {
    fc.assert(
      fc.property(
        fc
          .tuple(typed, extension, suffix)
          .chain(([base, ext, end]) =>
            takenBy(base, end + ext).map((taken) => ({ base, ext, end, taken })),
          ),
        ({ base, ext, end, taken }) => {
          const name = freeName(base, taken, ext, end);
          expect(keysOf(taken)).not.toContain(nameKey(name));
          expect(nameProblems(name)).toEqual([]);
          expect(utf8Length(name)).toBeLessThanOrEqual(MAX_MADE_NAME_BYTES);
          // "<base><suffix>.md", or "<base><suffix> 2.md": the suffix and extension kept whole.
          expect(name.endsWith(ext)).toBe(true);
          expect(
            name
              .slice(0, name.length - ext.length)
              .replace(/ \d+$/, '')
              .endsWith(end),
          ).toBe(true);
          if (ext === '.md') expect(freeNoteName(base, taken, end)).toBe(name);
        },
      ),
    );
  });
});

describe('renamedPath', () => {
  const folder = fc.constantFrom('', 'Fic', 'Fic/A Mended Scarf');
  const renaming = fc.boolean().chain((isNote) =>
    fc
      .tuple(
        folder,
        existing(isNote ? '.md' : ''),
        typed,
        fc.array(existing(isNote ? '.md' : ''), { maxLength: 6 }),
      )
      .chain(([at, name, title, others]) =>
        // Some siblings have the very name typed, in another case.
        fc
          .subarray([`${safeName(title)}.md`, safeName(title), safeName(title).toUpperCase()])
          .map((typedNames) => ({
            isNote,
            path: joinPath(at, name),
            title,
            siblings: [name, ...others, ...typedNames],
          })),
      ),
  );

  it('never gives a path whose name another sibling has; a valid name, in the same folder', () => {
    fc.assert(
      fc.property(renaming, ({ isNote, path, title, siblings }) => {
        const result = renamedPath(path, title, siblings, isNote);
        const own = nameKey(baseName(path));
        const others = keysOf(siblings).filter((key) => key !== own);
        if (!result.ok) {
          if (result.problem === 'taken') expect(others.length).toBeGreaterThan(0);
          return;
        }
        const name = baseName(result.path);
        expect(others).not.toContain(nameKey(name));
        expect(nameProblems(name)).toEqual([]);
        expect(parentOf(result.path)).toBe(parentOf(path));
        if (isNote)
          expect(name.slice(titleOf(name).length)).toBe(
            baseName(path).slice(titleOf(baseName(path)).length),
          );
      }),
    );
  });
});

describe('movedPath', () => {
  it('lands in the folder under a name nothing there has; a note keeps its extension', () => {
    fc.assert(
      fc.property(
        fc.boolean().chain((isNote) =>
          fc
            .tuple(existing(isNote ? '.md' : ''), fc.constantFrom('', 'Fic', 'Fic/Drafts'))
            .chain(([name, into]) =>
              takenBy(isNote ? titleOf(name) : name, isNote ? '.md' : '').map((taken) => ({
                isNote,
                path: joinPath('Old', name),
                into,
                taken,
              })),
            ),
        ),
        ({ isNote, path, into, taken }) => {
          const moved = movedPath(path, into, taken, isNote);
          const name = baseName(moved);
          expect(parentOf(moved)).toBe(into);
          expect(keysOf(taken)).not.toContain(nameKey(name));
          expect(nameProblems(name)).toEqual([]);
          if (isNote) expect(name.toLowerCase().endsWith('.md')).toBe(true);
        },
      ),
    );
  });
});
