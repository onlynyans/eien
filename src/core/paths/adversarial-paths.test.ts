// Adversarial: names that slip past the rules, and names a case-insensitive
// file system treats as one that nameKey keeps apart.

import { describe, expect, it } from 'vitest';
import { freeNoteName, isValidName, nameKey, nameProblems, safeName, vaultPath } from './index';

describe('safeName and freeNoteName never give a reserved name', () => {
  it('a typed title with a reserved name and an extension in it', () => {
    // "con.txt" → safeName "con.txt-" → the note "con.txt-.md", which is CON plus extensions.
    const name = freeNoteName('con.txt', []);
    expect(nameProblems(name)).toEqual([]);
    expect(() => vaultPath(name)).not.toThrow();
  });

  it('a long reserved title, cut to fit after its "-" was added', () => {
    const name = safeName(`con.${'a'.repeat(300)}`);
    expect(nameProblems(name)).toEqual([]);
  });
});

describe('nameKey treats as one what macOS treats as one', () => {
  // Each pair is one file on a case-insensitive APFS volume (checked on macOS 15):
  // writing the first and asking for the second finds it.
  it.each([
    ['Straße.md', 'STRASSE.md'],
    ['ΟΔΟΣ.md', 'οδος.md'], // capital sigma, and the final sigma it lowercases to at a word's end
    ['ſ.md', 's.md'], // long s
  ])('%s and %s', (a, b) => {
    expect(nameKey(a)).toBe(nameKey(b));
  });

  it('so a new note never gets a name the disk already holds', () => {
    expect(freeNoteName('STRASSE', ['Straße.md'])).toBe('STRASSE 2.md');
  });
});

describe('names the disk cannot store as written', () => {
  it('refuses a lone surrogate, which the disk stores as U+FFFD under another name', () => {
    // "a\uD800.md" and "a\uDC00.md" are both written as "a�.md": one file, two names.
    expect(isValidName('a\uD800.md')).toBe(false);
  });
});

// Found by the property tests (paths.property.test.ts).
describe('safeName always gives a name nameProblems accepts', () => {
  it('turns half an emoji, as a broken paste leaves it, into a space', () => {
    expect(safeName('a\uD83Eb')).toBe('a b');
    expect(safeName('\uD83E')).toBe('Untitled');
  });

  it('adds the "-" to a reserved word the cut to length leaves', () => {
    // "lpt¹ 永遠" isn't reserved, but cut to 8 bytes it's "lpt¹ ", trimmed to "lpt¹".
    const name = safeName('lpt¹ 永遠', 'Untitled', 8);
    expect(nameProblems(name)).toEqual([]);
    expect(name).toBe('lpt¹-');
  });
});
