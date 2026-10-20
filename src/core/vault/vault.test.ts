import { describe, expect, it } from 'vitest';
import {
  buildTree,
  type FolderNode,
  isNoteName,
  isSyncConflictName,
  kindOf,
  orderNames,
  parseFolderSettings,
  syncConflictOf,
  type VaultEntry,
} from './index';

const entry = (path: string, kind: VaultEntry['kind'] = 'note'): VaultEntry => ({
  path,
  kind,
  modified: 0,
  size: 0,
});

describe('notes and other files', () => {
  it.each(['Seventeen.md', 'NOTES.MD', 'a.b.md', '永遠.md'])('%s is a note', (name) => {
    expect(isNoteName(name)).toBe(true);
  });

  it.each(['.hidden.md', 'image.png', 'notes.markdown', 'md', 'readme.md.txt'])(
    '%s is not',
    (name) => {
      expect(isNoteName(name)).toBe(false);
    },
  );

  it('kinds folders, notes and other files', () => {
    expect(kindOf('Fic', true)).toBe('folder');
    expect(kindOf('Note.md', false)).toBe('note');
    expect(kindOf('cover.jpg', false)).toBe('file');
  });

  it('spots Syncthing conflict copies and the note they belong to', () => {
    const copy = 'Seventeen.sync-conflict-20261019-164012-ABCDEFG.md';
    expect(isSyncConflictName(copy)).toBe(true);
    expect(syncConflictOf(copy)).toBe('Seventeen.md');
    expect(isSyncConflictName('Seventeen.md')).toBe(false);
    expect(syncConflictOf('Seventeen.md')).toBeNull();
    expect(isSyncConflictName('Note.sync-conflict-2026-ABCDEFG.md')).toBe(false); // malformed stamp
  });
});

describe('buildTree', () => {
  const shape = (node: FolderNode): unknown => ({
    name: node.name,
    count: node.noteCount,
    notes: node.notes,
    folders: node.folders.map(shape),
  });

  it('nests folders, sorts naturally and counts notes at every depth', () => {
    const tree = buildTree(
      [
        entry('Ideas.md'),
        entry('Fic', 'folder'),
        entry('Fic/Chapter 10.md'),
        entry('Fic/Chapter 2.md'),
        entry('Fic/One-shots', 'folder'),
        entry('Fic/One-shots/Rain.md'),
        entry('cover.png', 'file'),
        entry('Empty', 'folder'),
        entry('apple.md'),
      ],
      'Vault',
    );
    expect(shape(tree)).toEqual({
      name: 'Vault',
      count: 5,
      notes: ['apple.md', 'Ideas.md'],
      folders: [
        { name: 'Empty', count: 0, notes: [], folders: [] },
        {
          name: 'Fic',
          count: 3,
          notes: ['Fic/Chapter 2.md', 'Fic/Chapter 10.md'],
          folders: [{ name: 'One-shots', count: 1, notes: ['Fic/One-shots/Rain.md'], folders: [] }],
        },
      ],
    });
  });

  it('makes folders that were not listed but hold notes', () => {
    const tree = buildTree([entry('a/b/c.md')], 'Vault');
    expect(tree.folders[0]?.path).toBe('a');
    expect(tree.folders[0]?.folders[0]?.path).toBe('a/b');
    expect(tree.noteCount).toBe(1);
  });

  it('is empty for an empty vault', () => {
    expect(shape(buildTree([], 'Vault'))).toEqual({
      name: 'Vault',
      count: 0,
      notes: [],
      folders: [],
    });
  });
});

describe('folder settings', () => {
  it('reads order and book', () => {
    expect(parseFolderSettings('{"order":["b.md","a.md"],"book":{"goal":40000}}')).toEqual({
      order: ['b.md', 'a.md'],
      book: { goal: 40000 },
    });
  });

  it.each([
    ['no file', null],
    ['empty', ''],
    ['not JSON', '{order: oops'],
    ['an array', '[1,2]'],
    ['null', 'null'],
    ['a string', '"hello"'],
  ])('reads %s as nothing set', (_, text) => {
    expect(parseFolderSettings(text)).toEqual({ order: [], book: null });
  });

  it('keeps what is usable and ignores the rest', () => {
    expect(parseFolderSettings('{"order":["a.md",3,null,"b.md"],"book":{"goal":"lots"}}')).toEqual({
      order: ['a.md', 'b.md'],
      book: {},
    });
    expect(parseFolderSettings('{"book":{"goal":-5}}').book).toEqual({});
    expect(parseFolderSettings('{"book":true}').book).toBeNull();
  });

  it('orders listed names first, skips missing and repeated ones, then the rest by name', () => {
    expect(
      orderNames(
        ['c.md', 'Chapter 10.md', 'a.md', 'b.md', 'Chapter 2.md'],
        ['b.md', 'gone.md', 'a.md', 'B.md'],
      ),
    ).toEqual(['b.md', 'a.md', 'c.md', 'Chapter 2.md', 'Chapter 10.md']);
  });
});
