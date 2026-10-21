import { describe, expect, it } from 'vitest';
import { orderFolders } from './folder-settings';
import { inYourOrder } from './pins';
import { buildTree } from './tree';

const entries = (...folders: string[]) =>
  folders.map((path) => ({ kind: 'folder' as const, path, modified: 0, size: 0 }));

describe('orderFolders', () => {
  it('puts each folder’s own folders in its order, the rest by name after', () => {
    const tree = buildTree(entries('A', 'B', 'C', 'D', 'B/x', 'B/y', 'B/z'), 'Vault');
    const orders: Record<string, string[]> = { '': ['C', 'A', 'Gone'], B: ['z', 'note.md', 'x'] };
    orderFolders(tree, (path) => orders[path] ?? []);
    expect(tree.folders.map((folder) => folder.name)).toEqual(['C', 'A', 'B', 'D']);
    expect(tree.folders[2]?.folders.map((folder) => folder.name)).toEqual(['z', 'x', 'y']);
  });

  it('with no order, keeps them by name', () => {
    const tree = buildTree(entries('b', 'a', 'Chapter 10', 'Chapter 2'), 'Vault');
    orderFolders(tree, () => []);
    expect(tree.folders.map((folder) => folder.name)).toEqual([
      'a',
      'b',
      'Chapter 2',
      'Chapter 10',
    ]);
  });
});

describe('inYourOrder', () => {
  const note = (path: string, modified: number) => ({ path, modified });

  it('notes not placed yet first, newest first; then your order, those still there', () => {
    const notes = [note('a.md', 1), note('b.md', 2), note('c.md', 3), note('d.md', 4)];
    expect(inYourOrder(notes, ['b.md', 'gone.md', 'a.md']).map((n) => n.path)).toEqual([
      'd.md',
      'c.md',
      'b.md',
      'a.md',
    ]);
  });

  it('with nothing placed, it’s newest first, as All Notes was', () => {
    const notes = [note('a.md', 1), note('b.md', 2)];
    expect(inYourOrder(notes, []).map((n) => n.path)).toEqual(['b.md', 'a.md']);
  });
});
