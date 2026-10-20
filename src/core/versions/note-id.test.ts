import { describe, expect, it } from 'vitest';
import {
  hasForeignNoteId,
  isUsableNoteId,
  NOTE_ID_LENGTH,
  newNoteId,
  noteIdOf,
  withNoteId,
} from './note-id';

const bytes = (...values: number[]) => Uint8Array.from(values);

describe('newNoteId', () => {
  it('makes ten letters and digits that read back as written: no I, L, O or U', () => {
    const id = newNoteId(bytes(0, 1, 18, 21, 24, 27, 31, 32, 255, 100));
    expect(id).toHaveLength(NOTE_ID_LENGTH);
    expect(id).toMatch(/^[0-9A-HJKMNP-TV-Z]+$/);
    expect(id).toBe('A1JNRVZ0Z4');
  });

  it('starts with a letter, so YAML never reads one as a number', () => {
    // All digits would be the number 0; "12E4567890" a float.
    for (const random of [
      bytes(0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
      bytes(1, 2, 14, 4, 5, 6, 7, 8, 9, 0),
    ]) {
      const id = newNoteId(random);
      expect(id).toMatch(/^[A-Z]/);
      expect(noteIdOf(`---\nid: ${id}\n---\n`)).toBe(id);
    }
  });

  it('refuses too few random bytes', () => {
    expect(() => newNoteId(bytes(1, 2, 3))).toThrow(RangeError);
  });
});

describe('noteIdOf', () => {
  it('reads the id from the front matter, and nothing from a note without one', () => {
    expect(noteIdOf('---\nid: 01JB2X4Q7Z\ntags: [a]\n---\nText.')).toBe('01JB2X4Q7Z');
    expect(noteIdOf('Text with no front matter.')).toBeNull();
    expect(noteIdOf('---\ntags: [a]\n---\nText.')).toBeNull();
    expect(noteIdOf('')).toBeNull();
  });

  it('takes an id another tool wrote, if it can name a folder: a UUID, a number', () => {
    expect(noteIdOf('---\nid: 3f2b9c1e-8a7d-4c2e-9b1a-0d5e6f7a8b9c\n---\n')).toBe(
      '3f2b9c1e-8a7d-4c2e-9b1a-0d5e6f7a8b9c',
    );
    expect(noteIdOf('---\nid: 42\n---\n')).toBe('42');
    expect(noteIdOf("---\nid: 'quoted_id'\n---\n")).toBe('quoted_id');
  });

  it('never takes an id that could reach outside its folder, or isn’t text', () => {
    for (const value of [
      '../../etc',
      'a/b',
      '..',
      '',
      'has space',
      '"x\\u0000y"',
      '[1, 2]',
      '{a: 1}',
      '4.5',
      'true',
    ]) {
      expect(noteIdOf(`---\nid: ${value}\n---\n`), value).toBeNull();
    }
    expect(isUsableNoteId('a'.repeat(65))).toBe(false);
  });

  it('reads nothing from broken front matter, a list, or an id under another key', () => {
    expect(noteIdOf('---\nid: [unclosed\n---\n')).toBeNull();
    expect(noteIdOf('---\n- id\n- x\n---\n')).toBeNull();
    expect(noteIdOf('---\nmeta:\n  id: ABC\n---\n')).toBeNull();
  });

  it('reads a "---" in the body as no front matter', () => {
    expect(noteIdOf('Text\n---\nid: ABC\n---\n')).toBeNull();
  });
});

describe('hasForeignNoteId', () => {
  it('sees another tool’s id, one Eien can’t use, at the top only', () => {
    expect(hasForeignNoteId('---\nid: a/b\n---\n')).toBe(true);
    expect(hasForeignNoteId('---\nid: [1, 2]\n---\n')).toBe(true);
    expect(hasForeignNoteId('---\nid: ABC\n---\n')).toBe(false); // usable: Eien's to use
    expect(hasForeignNoteId('---\nmeta:\n  id: a/b\n---\n')).toBe(false);
    expect(hasForeignNoteId('No front matter.')).toBe(false);
  });

  it('leaves an empty id to be filled in: a template’s `id:`, `id: null`, `id: ~`', () => {
    for (const empty of ['id:', 'id: null', 'id: ~', "id: ''"]) {
      const text = `---\n${empty}\n---\nBody`;
      expect(hasForeignNoteId(text), empty).toBe(false);
      expect(withNoteId(text, 'NEW1'), empty).toBe('---\nid: NEW1\n---\nBody');
    }
  });
});

describe('withNoteId', () => {
  it('gives a note with no front matter one holding only the id', () => {
    expect(withNoteId('# Title\n\nWords.', 'ABC123')).toBe(
      '---\nid: ABC123\n---\n# Title\n\nWords.',
    );
    expect(withNoteId('', 'ABC123')).toBe('---\nid: ABC123\n---\n');
  });

  it('adds the id as the first key, keeping every other line byte for byte', () => {
    const text =
      '---\n# kept as written\ntags:   [fic/aot,  draft]   # spaced oddly\ntitle: "Quoted: yes"\n---\nBody.\n';
    expect(withNoteId(text, 'NEW1')).toBe(
      '---\nid: NEW1\n# kept as written\ntags:   [fic/aot,  draft]   # spaced oddly\ntitle: "Quoted: yes"\n---\nBody.\n',
    );
  });

  it('puts a new id in place of the old, keeping its comment', () => {
    expect(withNoteId('---\ntags: [a]\nid: OLD   # given by Eien\n---\nBody', 'NEW')).toBe(
      '---\ntags: [a]\nid: NEW   # given by Eien\n---\nBody',
    );
    expect(withNoteId('---\nid: "OLD"\n---\n', 'NEW')).toBe('---\nid: NEW\n---\n');
  });

  it('fills empty front matter, and one closed by "..." or at the very end', () => {
    expect(withNoteId('---\n---\nBody', 'X1')).toBe('---\nid: X1\n---\nBody');
    expect(withNoteId('---\na: 1\n...\nBody', 'X1')).toBe('---\nid: X1\na: 1\n...\nBody');
    expect(withNoteId('---\na: 1\n---', 'X1')).toBe('---\nid: X1\na: 1\n---');
  });

  it('refuses rather than rewrite what it can’t change by a line', () => {
    expect(withNoteId('---\n- a list\n---\nBody', 'X1')).toBeNull();
    expect(withNoteId('---\nkey: [broken\n---\nBody', 'X1')).toBeNull();
    expect(withNoteId('---\nid: |\n  a block\n---\nBody', 'X1')).toBeNull();
    expect(withNoteId('---\n{tags: [a]}\n---\nBody', 'X1')).toBeNull();
    expect(withNoteId('Body', '../escape')).toBeNull();
  });

  it('reads back the id it wrote, every time it writes one', () => {
    for (const text of [
      '',
      'Body',
      '---\n---\n',
      '---\nid: OLD\n---\n',
      '---\ntags: [a]\n---\nBody',
    ]) {
      const next = withNoteId(text, 'ZZ99');
      expect(next === null ? null : noteIdOf(next), text).toBe('ZZ99');
    }
  });
});
