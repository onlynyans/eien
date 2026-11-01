import { describe, expect, it } from 'vitest';
import {
  buildTree,
  type FolderNode,
  inFolders,
  isNoteName,
  isSyncConflictName,
  kindOf,
  onShelf,
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

  it('reads a file saved with a byte-order mark, as some Windows editors save it', () => {
    expect(parseFolderSettings('\uFEFF{"order":["a.md"],"book":{}}')).toEqual({
      order: ['a.md'],
      book: {},
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
    // A goal is a whole number of words, more than none.
    for (const goal of ['0', '1.5', '1e400', '9007199254740993']) {
      expect(parseFolderSettings(`{"book":{"goal":${goal}}}`).book, goal).toEqual({});
    }
    expect(parseFolderSettings('{"book":{"goal":1}}').book).toEqual({ goal: 1 });
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

describe('EPUBs in the vault (#40)', () => {
  it('are their own kind, named by their file as a note is', async () => {
    const { epubTitleOf, isEpubName, kindOf } = await import('./index');
    expect(kindOf('Persuasion.epub', false)).toBe('epub');
    expect(kindOf('Persuasion.EPUB', false)).toBe('epub');
    expect(kindOf('.Persuasion.epub', false)).toBe('file');
    expect(kindOf('epub', false)).toBe('file');
    expect(isEpubName('notes.epub.md')).toBe(false);
    expect(epubTitleOf('North and South.epub')).toBe('North and South');
  });

  it('are called by their title where Eien names a file, as a note is', async () => {
    const { fileTitleOf } = await import('./index');
    expect(fileTitleOf('North and South.epub')).toBe('North and South');
    expect(fileTitleOf('Chapter 3.md')).toBe('Chapter 3');
    expect(fileTitleOf('cover.png')).toBe('cover.png');
    expect(fileTitleOf('Dune.epub.md')).toBe('Dune.epub'); // a note, whatever its title says
  });

  it('sit in the tree beside a folder’s notes, never among them, and not in a note’s own images', async () => {
    const { buildTree } = await import('./index');
    const entry = (path: string, kind: 'note' | 'folder' | 'epub') => ({
      path,
      kind,
      modified: 0,
      size: 0,
    });
    const tree = buildTree(
      [
        entry('Cooking', 'folder'),
        entry('Cooking/Soup.md', 'note'),
        entry('Cooking/Boston Cooking-School.epub', 'epub'),
        entry('Cooking/Soup.assets', 'folder'),
        entry('Cooking/Soup.assets/hidden.epub', 'epub'),
        entry('Novels/Persuasion.epub', 'epub'),
        entry('Novels/Emma.epub', 'epub'),
      ],
      'Vault',
    );
    const cooking = tree.folders.find((folder) => folder.name === 'Cooking');
    expect(cooking?.notes).toEqual(['Cooking/Soup.md']);
    expect(cooking?.epubs).toEqual(['Cooking/Boston Cooking-School.epub']);
    expect(cooking?.noteCount).toBe(1);
    expect(tree.folders.find((folder) => folder.name === 'Novels')?.epubs).toEqual([
      'Novels/Emma.epub',
      'Novels/Persuasion.epub',
    ]);
  });
});

describe('FOLDERS for writing, SHELF for reading (#40)', () => {
  const folderOf = (tree: FolderNode, path: string): FolderNode => {
    let node = tree;
    for (const name of path.split('/')) {
      const next = node.folders.find((folder) => folder.name === name);
      if (!next) throw new Error(`no folder ${path}`);
      node = next;
    }
    return node;
  };
  const tree = buildTree(
    [
      entry('Novels/Emma.epub', 'epub'),
      entry('Novels/Russian/Anna.epub', 'epub'),
      entry('Shelved/Dune.epub', 'epub'),
      entry('Shelved/New', 'folder'),
      entry('Deep/Books/Dune.epub', 'epub'),
      entry('Deep/Books/Notes/On Dune.md'),
      entry('Both/Draft.md'),
      entry('Both/Persuasion.epub', 'epub'),
      entry('Empty', 'folder'),
      entry('Art', 'folder'),
      entry('Art/cover.png', 'file'),
      entry('Covered/Dune.epub', 'epub'),
      entry('Covered/cover.jpg', 'file'),
    ],
    'Vault',
  );

  it('counts EPUBs at any depth, as notes are counted', () => {
    expect(tree.epubCount).toBe(6);
    expect(folderOf(tree, 'Novels').epubCount).toBe(2);
    expect(folderOf(tree, 'Deep').epubCount).toBe(1);
    expect(folderOf(tree, 'Deep').noteCount).toBe(1);
  });

  it('keeps out of FOLDERS a folder of EPUBs and nothing else, at any depth', () => {
    expect(inFolders(folderOf(tree, 'Novels'))).toBe(false);
    expect(inFolders(folderOf(tree, 'Novels/Russian'))).toBe(false);
    expect(inFolders(folderOf(tree, 'Covered'))).toBe(false); // a picture isn't anything FOLDERS shows
  });

  it('keeps in FOLDERS a folder with a note anywhere under it, or an empty folder', () => {
    expect(inFolders(folderOf(tree, 'Deep'))).toBe(true);
    expect(inFolders(folderOf(tree, 'Deep/Books'))).toBe(true);
    expect(inFolders(folderOf(tree, 'Empty'))).toBe(true);
    expect(inFolders(folderOf(tree, 'Art'))).toBe(true);
    // An empty folder among books keeps the folder it's in, so it's never cut off.
    expect(inFolders(folderOf(tree, 'Shelved/New'))).toBe(true);
    expect(inFolders(folderOf(tree, 'Shelved'))).toBe(true);
  });

  it('puts on SHELF the folders an EPUB is in, and a folder of both in both', () => {
    expect(
      ['Novels', 'Deep', 'Both', 'Shelved'].map((path) => onShelf(folderOf(tree, path))),
    ).toEqual([true, true, true, true]);
    expect(onShelf(folderOf(tree, 'Empty'))).toBe(false);
    expect(onShelf(folderOf(tree, 'Shelved/New'))).toBe(false);
    expect(inFolders(folderOf(tree, 'Both'))).toBe(true);
  });
});
