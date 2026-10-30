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

  it('notes the section of a folder row pressed, dragged from or given the keyboard', () => {
    const sides = new FolderSides();
    const tree = document.createElement('nav');
    const row = (key: string, folder: string) => {
      const button = document.createElement('button');
      button.dataset.key = key;
      button.dataset.folder = folder;
      button.append(document.createElement('span'));
      tree.append(button);
      return button;
    };
    const shelf = row('shelf:Novels', 'Novels');
    const folders = row('folder:Novels', 'Novels');
    sides.watch(tree);
    document.body.replaceChildren(tree);
    shelf.firstElementChild?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(sides.from).toBe('shelf');
    folders.focus();
    expect(sides.from).toBe('folders');
    shelf.focus();
    expect(sides.from).toBe('shelf');
  });

  it('gives a folder’s menu and keys their section', () => {
    const sides = new FolderSides();
    const acts = { menu: vi.fn(), rename: vi.fn(), move: vi.fn() };
    const on = sides.events('Novels', 'shelf', acts);
    const row = document.createElement('button');
    for (const [type, listener] of Object.entries(on ?? {})) {
      row.addEventListener(type, listener as EventListener);
    }
    row.dispatchEvent(new KeyboardEvent('keydown', { key: 'F2' }));
    row.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', altKey: true }));
    row.dispatchEvent(new MouseEvent('contextmenu'));
    expect(acts.rename).toHaveBeenCalledWith('Novels');
    expect(acts.move).toHaveBeenCalledWith('Novels', 'up', 'shelf');
    expect(acts.menu.mock.calls[0]?.[2]).toBe('shelf');
  });
});
