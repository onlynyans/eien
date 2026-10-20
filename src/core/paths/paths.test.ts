import { describe, expect, it } from 'vitest';
import {
  conflictName,
  freeNoteName,
  isValidName,
  nameKey,
  nameProblems,
  recoveredName,
  resolveLinkPath,
  safeName,
  stampOf,
  titleOf,
  VaultPathError,
  vaultPath,
} from './index';
import { MAX_NAME_BYTES, utf8Length } from './names';

describe('nameProblems', () => {
  it.each([
    'Seventeen.md',
    'A Mended Scarf',
    'notes-2026.md',
    'Ça va.md',
    '永遠.md',
    'scarf 🧣.md',
    'console.md',
    '.eien', // a dot-name is valid; it's hidden, not refused
  ])('accepts %s', (name) => {
    expect(nameProblems(name)).toEqual([]);
  });

  it.each([
    ['', 'empty'],
    ['.', 'dot-name'],
    ['..', 'dot-name'],
    ['a:b.md', 'forbidden-character'],
    ['what?.md', 'forbidden-character'],
    ['a/b', 'forbidden-character'],
    ['a\\b', 'forbidden-character'],
    ['tab\there', 'forbidden-character'],
    ['bell\u0007', 'forbidden-character'],
    ['CON', 'reserved'],
    ['con.md', 'reserved'],
    ['Aux.MD', 'reserved'],
    ['con.txt.backup', 'reserved'], // any extensions after it, as Windows counts them
    ['nul', 'reserved'],
    ['COM1.md', 'reserved'],
    ['lpt9', 'reserved'],
    ['ends with dot.', 'trailing-dot-or-space'],
    ['ends with space ', 'trailing-dot-or-space'],
    [' starts with space', 'leading-space'],
    ['a'.repeat(256), 'too-long'],
    ['永'.repeat(86), 'too-long'], // 258 bytes in UTF-8
  ])('refuses %j (%s)', (name, problem) => {
    expect(nameProblems(name)).toContain(problem);
  });

  it('counts bytes, not characters: 255 bytes fit, 256 do not', () => {
    expect(isValidName('a'.repeat(255))).toBe(true);
    expect(isValidName('永'.repeat(85))).toBe(true); // 255 bytes
    expect(isValidName(`${'a'.repeat(254)}é`)).toBe(false); // 256 bytes
  });
});

describe('nameKey', () => {
  it('treats names that differ only in case or normalisation as one', () => {
    expect(nameKey('Note.md')).toBe(nameKey('NOTE.MD'));
    expect(nameKey('Cafe\u0301.md')).toBe(nameKey('Café.md'));
  });
});

describe('safeName', () => {
  it.each([
    ['Chapter 1: The Tear', 'Chapter 1 The Tear'],
    ['  spaced   out  ', 'spaced out'],
    ['what?', 'what'],
    ['...dots...', 'dots'],
    ['a/b\\c', 'a b c'],
    ['CON', 'CON-'],
    ['', 'Untitled'],
    ['???', 'Untitled'],
    ['line\nbreak', 'line break'],
  ])('%j becomes %j', (typed, name) => {
    expect(safeName(typed)).toBe(name);
  });

  it('always gives a valid name', () => {
    for (const typed of ['', ' . ', 'CON.', 'a:'.repeat(200), '永'.repeat(300), 'é'.repeat(300)]) {
      expect(isValidName(safeName(typed))).toBe(true);
    }
  });

  it('never cuts a character in half', () => {
    const name = safeName('🧣'.repeat(100), 'Untitled', 10); // each is 4 bytes
    expect(name).toBe('🧣🧣');
  });
});

describe('freeNoteName', () => {
  it('uses the title when free', () => {
    expect(freeNoteName('Seventeen', [])).toBe('Seventeen.md');
  });

  it('counts up past taken names, ignoring case', () => {
    expect(freeNoteName('Untitled', ['untitled.md', 'Untitled 2.md'])).toBe('Untitled 3.md');
  });

  it('keeps the suffix whole when the title is long', () => {
    const name = freeNoteName('永'.repeat(200), [], ' (conflict 2026-10-19 16-40)');
    expect(name.endsWith(' (conflict 2026-10-19 16-40).md')).toBe(true);
    expect(utf8Length(name)).toBeLessThanOrEqual(MAX_NAME_BYTES);
    expect(isValidName(name)).toBe(true);
  });
});

describe('stampOf, conflictName, recoveredName', () => {
  const date = new Date(2026, 9, 9, 7, 5); // 9 Oct 2026, 07:05 local

  it('stamps with padded local time and no forbidden characters', () => {
    expect(stampOf(date)).toBe('2026-10-09 07-05');
    expect(isValidName(stampOf(date))).toBe(true);
  });

  it('names a conflict copy beside the note', () => {
    expect(conflictName('Seventeen.md', date, ['Seventeen.md'])).toBe(
      'Seventeen (conflict 2026-10-09 07-05).md',
    );
  });

  it('never reuses a name already there', () => {
    const taken = ['Seventeen.md', 'Seventeen (conflict 2026-10-09 07-05).md'];
    expect(conflictName('Seventeen.md', date, taken)).toBe(
      'Seventeen (conflict 2026-10-09 07-05) 2.md',
    );
  });

  it('names a recovered draft', () => {
    expect(recoveredName('Seventeen.md', date, [])).toBe(
      'Seventeen (recovered 2026-10-09 07-05).md',
    );
  });

  it('titleOf drops .md in any case, and only .md', () => {
    expect(titleOf('Note.md')).toBe('Note');
    expect(titleOf('Note.MD')).toBe('Note');
    expect(titleOf('Note.markdown')).toBe('Note.markdown');
  });
});

describe('vaultPath', () => {
  it.each([
    ['', ''],
    ['Note.md', 'Note.md'],
    ['Fic/A Mended Scarf/Seventeen.md', 'Fic/A Mended Scarf/Seventeen.md'],
    ['Cafe\u0301.md', 'Café.md'],
  ])('accepts %j', (path, normal) => {
    expect(vaultPath(path)).toBe(normal);
  });

  it.each([
    '../outside.md',
    'Fic/../../outside.md',
    './Note.md',
    '/etc/passwd',
    'C:/Windows/notes.md',
    'c:notes.md',
    'Fic\\Note.md',
    'Fic//Note.md',
    'Fic/',
    'Fic/CON.md',
    'Fic/what?.md',
  ])('refuses %j', (path) => {
    expect(() => vaultPath(path)).toThrow(VaultPathError);
  });

  it('refuses something that is not text', () => {
    expect(() => vaultPath(42 as unknown as string)).toThrow(VaultPathError);
  });
});

describe('resolveLinkPath', () => {
  it.each([
    ['Fic', 'cover.png', 'Fic/cover.png'],
    ['Fic', './cover.png', 'Fic/cover.png'],
    ['Fic/Scarf', '../art/cover.png', 'Fic/art/cover.png'],
    ['Fic', '/attachments/cover.png', 'attachments/cover.png'],
    ['', 'cover.png', 'cover.png'],
    ['Fic', 'my%20cover.png', 'Fic/my cover.png'],
    ['Fic', '<my cover.png>', 'Fic/my cover.png'],
    ['Fic', 'cover.png#top', 'Fic/cover.png'],
    ['Fic', 'cover.png?v=2', 'Fic/cover.png'],
    ['Fic', 'Caf%C3%A9.png', 'Fic/Café.png'],
  ])('from %j, %j is %j', (folder, ref, path) => {
    expect(resolveLinkPath(folder, ref)).toBe(path);
  });

  it.each([
    ['Fic', '../../outside.png'],
    ['', '../outside.png'],
    ['Fic', 'https://example.com/cover.png'],
    ['Fic', 'data:image/png;base64,xyz'],
    ['Fic', '//example.com/cover.png'],
    ['Fic', 'file:///etc/passwd'],
    ['Fic', 'C:/Windows/win.ini'],
    ['Fic', '%E0%A4%A.png'],
    ['Fic', 'CON.png'],
    ['Fic', ''],
    ['Fic', '/'],
  ])('from %j, %j is nothing', (folder, ref) => {
    expect(resolveLinkPath(folder, ref)).toBeNull();
  });
});
