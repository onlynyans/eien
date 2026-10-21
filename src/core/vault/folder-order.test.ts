import { describe, expect, it } from 'vitest';
import { orderFolders } from './folder-settings';
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
