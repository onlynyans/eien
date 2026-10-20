// Organizing a vault (phase 6b): renaming and moving notes and folders,
// their order, books, and pins — the rules, without a disk.

import { describe, expect, it } from 'vitest';
import { isWatchedPath, movedPath, renamedPath } from '../paths';
import {
  movedPins,
  orderNames,
  parseFolderSettings,
  parsePins,
  pinsText,
  placedBefore,
  presentInOrder,
  renamedInOrder,
  withFolderSettings,
  withoutInOrder,
  withoutPins,
  withPin,
} from './index';

describe('renamedPath', () => {
  it('renames a note from its new title, in its own folder, keeping its extension', () => {
    expect(renamedPath('Fic/Old.md', 'New title', ['Old.md'], true)).toEqual({
      ok: true,
      path: 'Fic/New title.md',
    });
    expect(renamedPath('Old.MD', 'New', ['Old.MD'], true)).toEqual({ ok: true, path: 'New.MD' });
  });

  it('lets a note change only its case, though the system sees one name', () => {
    expect(renamedPath('note.md', 'Note', ['note.md'], true)).toEqual({
      ok: true,
      path: 'Note.md',
    });
  });

  it('refuses a name another file has, case and accents aside, rather than number it', () => {
    expect(renamedPath('A.md', 'Ideas', ['A.md', 'ideas.md'], true)).toEqual({
      ok: false,
      problem: 'taken',
    });
    expect(renamedPath('A.md', 'Café', ['A.md', 'Café.md'], true)).toEqual({
      ok: false,
      problem: 'taken',
    });
    expect(renamedPath('Fic', 'Research', ['Fic', 'Research'], false)).toEqual({
      ok: false,
      problem: 'taken',
    });
  });

  it('makes a typed title safe, and refuses one that is nothing but spaces and dots', () => {
    expect(renamedPath('A.md', 'What now? A/B: "yes"', [], true)).toEqual({
      ok: true,
      path: 'What now A B yes.md',
    });
    expect(renamedPath('A.md', 'con', [], true)).toEqual({ ok: true, path: 'con-.md' });
    for (const typed of ['', '   ', '...', ' . ']) {
      expect(renamedPath('A.md', typed, [], true)).toEqual({ ok: false, problem: 'empty' });
    }
  });

  it('renames a folder without adding an extension', () => {
    expect(renamedPath('Fic/Old folder', 'New folder', [], false)).toEqual({
      ok: true,
      path: 'Fic/New folder',
    });
  });

  it('keeps a long title within the system’s limit, extension included', () => {
    const renamed = renamedPath('A.md', 'é'.repeat(300), [], true);
    expect(renamed.ok && new TextEncoder().encode(renamed.path).length).toBeLessThanOrEqual(255);
    expect(renamed.ok && renamed.path.endsWith('.md')).toBe(true);
  });
});

describe('movedPath', () => {
  it('keeps the name in its new folder, exactly as it was', () => {
    expect(movedPath('Inbox/Café.md', 'Fic', ['Other.md'], true)).toBe('Fic/Café.md');
    expect(movedPath('Fic/A.md', '', [], true)).toBe('A.md');
  });

  it('numbers it when its name is taken there, so nothing is replaced', () => {
    expect(movedPath('Inbox/Ideas.md', 'Fic', ['ideas.md', 'Ideas 2.md'], true)).toBe(
      'Fic/Ideas 3.md',
    );
    expect(movedPath('Old/Notes', 'Archive', ['Notes'], false)).toBe('Archive/Notes 2');
  });
});

describe('the order of a folder', () => {
  const shown = ['a.md', 'b.md', 'c.md', 'd.md'];

  it('places a note before another, or last', () => {
    expect(placedBefore(shown, 'd.md', 'b.md')).toEqual(['a.md', 'd.md', 'b.md', 'c.md']);
    expect(placedBefore(shown, 'a.md', null)).toEqual(['b.md', 'c.md', 'd.md', 'a.md']);
    expect(placedBefore(shown, 'b.md', 'b.md')).toEqual(['a.md', 'c.md', 'd.md', 'b.md']); // onto itself: last
    expect(placedBefore(shown, 'b.md', 'gone.md')).toEqual(['a.md', 'c.md', 'd.md', 'b.md']);
  });

  it('places a note new to the list', () => {
    expect(placedBefore(shown, 'new.md', 'a.md')).toEqual(['new.md', ...shown]);
  });

  it('follows a renamed note, and forgets a removed one', () => {
    expect(renamedInOrder(shown, 'b.md', 'B renamed.md')).toEqual([
      'a.md',
      'B renamed.md',
      'c.md',
      'd.md',
    ]);
    expect(withoutInOrder(shown, 'c.md')).toEqual(['a.md', 'b.md', 'd.md']);
    expect(
      orderNames(
        ['B renamed.md', 'a.md'],
        renamedInOrder(['b.md', 'a.md'], 'b.md', 'B renamed.md'),
      ),
    ).toEqual(['B renamed.md', 'a.md']);
  });
});

describe('withFolderSettings', () => {
  it('writes an order and a book into a folder with no file yet', () => {
    const text = withFolderSettings(null, { order: ['b.md', 'a.md'], book: {} });
    expect(parseFolderSettings(text)).toEqual({ order: ['b.md', 'a.md'], book: {} });
  });

  it('changes only what it’s asked, keeping every other key, a goal and unknown ones', () => {
    const before = '{"order":["a.md"],"book":{"goal":40000},"future":{"x":1}}';
    expect(JSON.parse(withFolderSettings(before, { order: ['b.md', 'a.md'] }) ?? '')).toEqual({
      order: ['b.md', 'a.md'],
      book: { goal: 40000 },
      future: { x: 1 },
    });
    expect(JSON.parse(withFolderSettings(before, { book: null }) ?? '')).toEqual({
      order: ['a.md'],
      future: { x: 1 },
    });
    expect(JSON.parse(withFolderSettings(before, { order: [] }) ?? '')).toEqual({
      book: { goal: 40000 },
      future: { x: 1 },
    });
  });

  it('never writes over a file that isn’t a JSON object', () => {
    for (const text of ['{ "order": [', '[1,2]', '"text"', 'null']) {
      expect(withFolderSettings(text, { book: {} })).toBeNull();
    }
  });

  it('reads one with a byte-order mark, and keeps a "__proto__" key a plain key', () => {
    expect(parseFolderSettings(withFolderSettings('﻿{"order":["a.md"]}', { book: {} }))).toEqual({
      order: ['a.md'],
      book: {},
    });
    const text = withFolderSettings('{"__proto__":{"polluted":true}}', { book: {} }) ?? '';
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(text).toContain('"__proto__"');
  });
});

describe('pins', () => {
  it('reads a list of paths, once each, and nothing from a broken file', () => {
    expect(parsePins('["a.md","Fic/b.md","a.md",3,null]')).toEqual(['a.md', 'Fic/b.md']);
    for (const text of [null, '', '{', '{"a":1}', '"a.md"']) expect(parsePins(text)).toEqual([]);
    expect(parsePins(pinsText(['x.md']))).toEqual(['x.md']);
    expect(parsePins('﻿["x.md"]')).toEqual(['x.md']);
  });

  it('pins last and unpins, never twice', () => {
    expect(withPin(['a.md'], 'b.md', true)).toEqual(['a.md', 'b.md']);
    expect(withPin(['a.md', 'b.md'], 'a.md', true)).toEqual(['b.md', 'a.md']);
    expect(withPin(['a.md', 'b.md'], 'a.md', false)).toEqual(['b.md']);
  });

  it('follows a note, or a folder and all in it, when it moves; forgets what’s trashed', () => {
    const pins = ['Fic/a.md', 'Fic/Deep/b.md', 'Ficlet.md', 'c.md'];
    expect(movedPins(pins, 'Fic', 'Fiction')).toEqual([
      'Fiction/a.md',
      'Fiction/Deep/b.md',
      'Ficlet.md',
      'c.md',
    ]);
    expect(movedPins(pins, 'c.md', 'Fic/c.md')).toEqual([
      'Fic/a.md',
      'Fic/Deep/b.md',
      'Ficlet.md',
      'Fic/c.md',
    ]);
    expect(withoutPins(pins, 'Fic')).toEqual(['Ficlet.md', 'c.md']);
  });
});

describe('order and the watcher, as other devices see them', () => {
  it('follows and forgets a note listed in another case, as orderNames places it', () => {
    expect(renamedInOrder(['chapter two.md', 'One.md'], 'Chapter Two.md', 'Prologue.md')).toEqual([
      'Prologue.md',
      'One.md',
    ]);
    expect(withoutInOrder(['chapter two.md', 'One.md'], 'Chapter Two.md')).toEqual(['One.md']);
    expect(renamedInOrder(['a.md'], 'gone.md', 'b.md')).toEqual(['a.md']);
  });

  it('keeps only the listed names that are there, spelled as the files are', () => {
    expect(
      presentInOrder(
        ['Gone.md', 'chapter two.md', 'One.md'],
        ['One.md', 'Chapter Two.md', 'Unlisted.md'],
      ),
    ).toEqual(['Chapter Two.md', 'One.md']);
    expect(presentInOrder([], ['a.md'])).toEqual([]);
  });

  it('watches every folder’s settings, and still no other hidden file', () => {
    expect(isWatchedPath('.eien-folder.json')).toBe(true);
    expect(isWatchedPath('Fic/Scarf/.eien-folder.json')).toBe(true);
    expect(isWatchedPath('.hidden/.eien-folder.json')).toBe(false);
    expect(isWatchedPath('Fic/.eien-folder.json.eien.tmp')).toBe(false);
    expect(isWatchedPath('Fic/.other.json')).toBe(false);
  });
});
