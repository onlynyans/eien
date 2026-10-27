import { describe, expect, it } from 'vitest';
import { orderFolders } from './folder-settings';
import { inGroups, subfoldersOf, withHeads } from './subfolders';
import { buildTree } from './tree';

const entries = (...paths: string[]) =>
  paths.map((path) => ({
    kind: path.endsWith('.md') ? ('note' as const) : ('folder' as const),
    path,
    modified: 0,
    size: 0,
  }));

const note = (path: string) => ({ path });

describe('subfoldersOf', () => {
  it('lists every folder below, at every depth, each just before the folders in it, in your order', () => {
    const tree = buildTree(
      entries('Fic', 'Fic/Arc 1', 'Fic/Arc 2', 'Fic/Arc 1/Cut', 'Fic/Arc 2/Old', 'Fic/Arc 2/New'),
      'Vault',
    );
    orderFolders(tree, (path) => (path === 'Fic' ? ['Arc 2', 'Arc 1'] : []));
    const fic = tree.folders[0];
    if (!fic) throw new Error('no Fic');
    expect(subfoldersOf(fic)).toEqual([
      { path: 'Fic/Arc 2', name: 'Arc 2' },
      { path: 'Fic/Arc 2/New', name: 'Arc 2 / New' },
      { path: 'Fic/Arc 2/Old', name: 'Arc 2 / Old' },
      { path: 'Fic/Arc 1', name: 'Arc 1' },
      { path: 'Fic/Arc 1/Cut', name: 'Arc 1 / Cut' },
    ]);
  });

  it('is empty for a folder with none', () => {
    const tree = buildTree(entries('Fic', 'Fic/a.md'), 'Vault');
    expect(subfoldersOf(tree.folders[0] ?? tree)).toEqual([]);
  });

  it('from the vault itself, names start at its top folders', () => {
    const tree = buildTree(entries('A', 'A/B'), 'Vault');
    expect(subfoldersOf(tree).map((folder) => folder.name)).toEqual(['A', 'A / B']);
  });
});

describe('inGroups', () => {
  const subs = [
    { path: 'Fic/B', name: 'B' },
    { path: 'Fic/A', name: 'A' },
  ];

  it('puts the folder’s own notes first, then each subfolder’s, in the subfolders’ order', () => {
    const notes = ['Fic/A/1.md', 'Fic/own.md', 'Fic/B/2.md', 'Fic/A/3.md', 'Fic/B/4.md'].map(note);
    expect(inGroups(notes, subs).map((n) => n.path)).toEqual([
      'Fic/own.md',
      'Fic/B/2.md',
      'Fic/B/4.md',
      'Fic/A/1.md',
      'Fic/A/3.md',
    ]);
  });

  it('keeps the order each folder’s notes came in (a search’s best first)', () => {
    const notes = ['Fic/A/z.md', 'Fic/A/a.md', 'Fic/A/m.md'].map(note);
    expect(inGroups(notes, subs).map((n) => n.path)).toEqual([
      'Fic/A/z.md',
      'Fic/A/a.md',
      'Fic/A/m.md',
    ]);
  });
});

describe('withHeads', () => {
  const subs = [
    { path: 'Fic/A', name: 'A' },
    { path: 'Fic/A/Old', name: 'A / Old' },
    { path: 'Fic/Empty', name: 'Empty' },
  ];
  const shape = (rows: ReturnType<typeof withHeads<{ path: string }>>) =>
    rows.map((row) => ('head' in row ? `# ${row.head.name}` : row.note.path));

  it('puts a head before each subfolder’s first note, none before the folder’s own', () => {
    const notes = ['Fic/own.md', 'Fic/A/1.md', 'Fic/A/2.md', 'Fic/A/Old/3.md'].map(note);
    expect(shape(withHeads(notes, subs))).toEqual([
      'Fic/own.md',
      '# A',
      'Fic/A/1.md',
      'Fic/A/2.md',
      '# A / Old',
      'Fic/A/Old/3.md',
    ]);
  });

  it('draws no head for a subfolder with no notes listed', () => {
    expect(shape(withHeads([note('Fic/A/Old/3.md')], subs))).toEqual([
      '# A / Old',
      'Fic/A/Old/3.md',
    ]);
    expect(withHeads([], subs)).toEqual([]);
  });

  it('with no subfolders, is the notes as they are', () => {
    const notes = ['Fic/a.md', 'Fic/b.md'].map(note);
    expect(shape(withHeads(notes, []))).toEqual(['Fic/a.md', 'Fic/b.md']);
  });
});
