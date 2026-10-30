// Your order for folders and tags, against a vault state and organizer stood in for.

import { describe, expect, it, vi } from 'vitest';
import type { TagNode } from '../../core/tags';
import type { FolderNode } from '../../core/vault';
import {
  dropFolder,
  type FolderOrderOf,
  folderInto,
  folderOut,
  nudgeFolder,
  placeFolderBefore,
  shownBeside,
  tagOrderAfter,
} from './folder-order';

/** What a folder holds itself (#40): FOLDERS lists it unless it's EPUBs alone; SHELF if it has one. */
type Holds = 'notes' | 'epubs' | 'both';

/** The tree as the vault's state has it, in your order, each folder holding what `holds` says. */
function treeOf(names: Record<string, string[]>, holds: Record<string, Holds>): FolderNode {
  const node = (path: string): FolderNode => {
    const folders = (names[path] ?? []).map((name) => node(path ? `${path}/${name}` : name));
    const notes = holds[path] === 'epubs' || !holds[path] ? [] : [`${path}/Note.md`];
    const epubs = holds[path] === 'notes' || !holds[path] ? [] : [`${path}/Book.epub`];
    return {
      name: path.slice(path.lastIndexOf('/') + 1),
      path,
      folders,
      notes,
      epubs,
      noteCount: folders.reduce((sum, each) => sum + each.noteCount, notes.length),
      epubCount: folders.reduce((sum, each) => sum + each.epubCount, epubs.length),
    };
  };
  return node('');
}

/** Folders by their folder, as the tree shows them; moving one moves it there, last. */
function vault(folders: Record<string, string[]>, holds: Record<string, Holds> = {}) {
  const names = structuredClone(folders);
  const setOrder = vi.fn(
    async (folder: string, { folders: order }: { folders?: readonly string[] }) => {
      if (order) names[folder] = [...order];
      return true;
    },
  );
  const moveInto = vi.fn(async (path: string, folder: string) => {
    const parent = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
    const name = path.slice(path.lastIndexOf('/') + 1);
    names[parent] = (names[parent] ?? []).filter((one) => one !== name);
    names[folder] = [...(names[folder] ?? []), name];
    return folder ? `${folder}/${name}` : name;
  });
  const of = {
    state: {
      folderNames: (folder: string) => names[folder] ?? [],
      get tree() {
        return treeOf(names, holds);
      },
      refresh: vi.fn(async () => {}),
    },
    organizer: { setOrder, moveInto },
  } as unknown as FolderOrderOf;
  return { of, names, setOrder, moveInto };
}

describe('folders in your order', () => {
  it('⌥↑ ⌥↓ move a folder among those beside it, and not past either end', async () => {
    const { of, names } = vault({ '': ['A', 'B', 'C'] });
    expect(await nudgeFolder(of, 'B', 1, 'folders')).toBe(true);
    expect(names['']).toEqual(['A', 'C', 'B']);
    expect(await nudgeFolder(of, 'B', 1, 'folders')).toBe(false);
    expect(await nudgeFolder(of, 'A', -1, 'folders')).toBe(false);
  });

  it('a folder placed before another, or last; where it is, nothing written', async () => {
    const { of, names, setOrder } = vault({ '': ['A', 'B', 'C'] });
    await placeFolderBefore(of, 'C', 'A');
    expect(names['']).toEqual(['C', 'A', 'B']);
    await placeFolderBefore(of, 'C', null);
    expect(names['']).toEqual(['A', 'B', 'C']);
    setOrder.mockClear();
    await placeFolderBefore(of, 'A', 'B');
    expect(setOrder).not.toHaveBeenCalled();
  });

  it('⌥← takes a folder out of its folder, to just after it', async () => {
    const { of, names } = vault({ '': ['A', 'Fic', 'Z'], Fic: ['Scarf', 'Wall'] });
    expect(await folderOut(of, 'Fic/Scarf')).toBe('Scarf');
    expect(names['']).toEqual(['A', 'Fic', 'Scarf', 'Z']);
    expect(names.Fic).toEqual(['Wall']);
    expect(await folderOut(of, 'A')).toBeNull(); // at the top already
  });

  it('⌥→ puts a folder into the one above it; the first has none above', async () => {
    const { of, names } = vault({ '': ['A', 'B'] });
    expect(await folderInto(of, 'B', 'folders')).toBe('A/B');
    expect(names.A).toEqual(['B']);
    expect(await folderInto(of, 'A', 'folders')).toBeNull();
  });

  it('moves among the folders FOLDERS shows, stepping over one of EPUBs alone (#40)', async () => {
    const { of, names } = vault(
      { '': ['A', 'Books', 'C'] },
      { A: 'notes', Books: 'epubs', C: 'notes' },
    );
    expect(await nudgeFolder(of, 'A', 1, 'folders')).toBe(true);
    expect(names['']).toEqual(['Books', 'C', 'A']);
    expect(await nudgeFolder(of, 'A', 1, 'folders')).toBe(false); // last in FOLDERS
    expect(await nudgeFolder(of, 'A', -1, 'folders')).toBe(true);
    expect(names['']).toEqual(['Books', 'A', 'C']);
    expect(await nudgeFolder(of, 'A', -1, 'folders')).toBe(false); // first in FOLDERS
    expect(await folderInto(of, 'C', 'folders')).toBe('A/C'); // the folder shown above it, not Books
  });

  it('names the folders a section shows beside one, which its menu moves it among', () => {
    const { of } = vault(
      { '': ['Novels', 'Drafts', 'Both', 'Empty'] },
      {
        Novels: 'epubs',
        Drafts: 'notes',
        Both: 'both',
      },
    );
    expect(shownBeside(of.state, 'Both', 'folders')).toEqual(['Drafts', 'Both', 'Empty']);
    expect(shownBeside(of.state, 'Both', 'shelf')).toEqual(['Novels', 'Both']);
  });

  it('moves among the folders SHELF shows, stepping over one of notes alone', async () => {
    const { of, names } = vault(
      { '': ['Novels', 'Drafts', 'Both'] },
      { Novels: 'epubs', Drafts: 'notes', Both: 'both' },
    );
    expect(await nudgeFolder(of, 'Novels', 1, 'shelf')).toBe(true);
    expect(names['']).toEqual(['Drafts', 'Both', 'Novels']);
    expect(await nudgeFolder(of, 'Both', 1, 'folders')).toBe(false); // FOLDERS: Drafts, Both
    expect(await folderInto(of, 'Novels', 'shelf')).toBe('Both/Novels');
    expect(await folderInto(of, 'Both', 'shelf')).toBeNull(); // Drafts isn't on SHELF
  });

  it('a folder dropped beside one elsewhere moves there, then takes its place', async () => {
    const { of, names } = vault({ '': ['A', 'Fic'], Fic: ['Scarf', 'Wall'] });
    expect(await dropFolder(of, 'A', { after: 'Fic/Scarf' })).toBe('Fic/A');
    expect(names.Fic).toEqual(['Scarf', 'A', 'Wall']);
    expect(await dropFolder(of, 'Fic/Wall', { before: 'Fic/Scarf' })).toBe('Fic/Wall');
    expect(names.Fic).toEqual(['Wall', 'Scarf', 'A']);
  });

  it('dropped inside a folder, or out of its own', async () => {
    const { of, names } = vault({ '': ['A', 'B'], B: ['C'] });
    expect(await dropFolder(of, 'A', { into: 'B' })).toBe('B/A');
    expect(names.B).toEqual(['C', 'A']);
    expect(await dropFolder(of, 'B/C', { out: true })).toBe('C');
    expect(names['']).toEqual(['B', 'C']);
  });
});

describe('tagOrderAfter', () => {
  const node = (key: string, children: TagNode[] = []): TagNode => ({
    name: key.split('/').at(-1) ?? key,
    tag: key,
    key,
    count: 1,
    children,
  });
  const tags = [node('a'), node('fic', [node('fic/x'), node('fic/y')]), node('z')];

  it('swaps a tag with the one beside it, every level kept in the order written', () => {
    expect(tagOrderAfter(tags, 'a', 1)).toEqual(['fic', 'fic/x', 'fic/y', 'a', 'z']);
    expect(tagOrderAfter(tags, 'fic/y', -1)).toEqual(['a', 'fic', 'fic/y', 'fic/x', 'z']);
  });

  it('says so at either end', () => {
    expect(tagOrderAfter(tags, 'a', -1)).toBeNull();
    expect(tagOrderAfter(tags, 'fic/y', 1)).toBeNull();
    expect(tagOrderAfter(tags, 'missing', 1)).toBeNull();
  });
});
