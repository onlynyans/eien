import { describe, expect, it, vi } from 'vitest';
import { buildTree, type VaultEntry } from '../../core/vault';
import { FolderSides } from './folder-sides';

const entry = (path: string, kind: VaultEntry['kind']): VaultEntry => ({
  path,
  kind,
  modified: 0,
  size: 0,
});
const TREE = buildTree(
  [
    entry('Novels/Emma.epub', 'epub'),
    entry('Drafts/One.md', 'note'),
    entry('Both/One.md', 'note'),
    entry('Both/Emma.epub', 'epub'),
  ],
  'Vault',
);

describe('a folder’s section (#40)', () => {
  it('renames a folder where it was asked from, or in the other section when it isn’t there', () => {
    const sides = new FolderSides();
    sides.from = 'shelf';
    expect(sides.where(TREE, 'Both')).toBe('shelf');
    expect(sides.where(TREE, 'Novels')).toBe('shelf');
    expect(sides.where(TREE, 'Drafts')).toBe('folders'); // not on SHELF
    sides.from = 'folders';
    expect(sides.where(TREE, 'Both')).toBe('folders');
    expect(sides.where(TREE, 'Novels')).toBe('shelf'); // not in FOLDERS
    // A folder not in the tree yet (one just made, empty): FOLDERS, where it will be.
    expect(sides.where(TREE, 'New', 'shelf')).toBe('folders');
  });

  it('gives the keyboard to the folder in the section it was moved in first, then the other', () => {
    const sides = new FolderSides();
    expect(sides.keys('A/B')).toEqual(['folder:A/B', 'shelf:A/B']);
    sides.from = 'shelf';
    expect(sides.keys('A/B')).toEqual(['shelf:A/B', 'folder:A/B']);
  });

  it('notes the section a folder’s menu, F2 or ⌥ and an arrow was used in, before it acts', () => {
    const sides = new FolderSides();
    const seen: string[] = [];
    const acts = {
      menu: vi.fn((_path, _at, section) => seen.push(`${sides.from}/${section}`)),
      rename: vi.fn(() => seen.push(sides.from)),
      move: vi.fn((_path, _how, section) => seen.push(`${sides.from}/${section}`)),
    };
    const on = sides.events('Novels', 'shelf', acts);
    const row = document.createElement('button');
    for (const [type, listener] of Object.entries(on ?? {})) {
      row.addEventListener(type, listener as EventListener);
    }
    row.dispatchEvent(new KeyboardEvent('keydown', { key: 'F2' }));
    sides.from = 'folders';
    row.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', altKey: true }));
    sides.from = 'folders';
    row.dispatchEvent(new MouseEvent('contextmenu'));
    expect(seen).toEqual(['shelf', 'shelf/shelf', 'shelf/shelf']);
    expect(acts.move).toHaveBeenCalledWith('Novels', 'up', 'shelf');
  });
});
