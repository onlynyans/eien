import { describe, expect, it } from 'vitest';
import { MemoryStorage } from '../../platform/memory/memory-storage';
import { when } from '../list/when';
import { findFolder, VaultState } from './vault-state';

async function vault(files: Record<string, string>) {
  const storage = new MemoryStorage();
  for (const [path, text] of Object.entries(files)) storage.put(path, text);
  const state = new VaultState(storage, 'Ink & Ash');
  await state.refresh();
  return state;
}

describe('VaultState', () => {
  it('lists every note, newest first, for All Notes', async () => {
    const state = await vault({
      'Old.md': 'a',
      'Fic/Middle.md': 'b',
      'New.md': 'c',
      'cover.png': 'x',
    });
    const list = await state.notesFor({ kind: 'all' });
    expect(list.heading).toBe('All Notes');
    expect(list.notes.map((n) => n.title)).toEqual(['New', 'Middle', 'Old']);
  });

  it('lists a folder’s own notes by name', async () => {
    const state = await vault({
      'Fic/b.md': '',
      'Fic/A.md': '',
      'Fic/Deeper/c.md': '',
      'Top.md': '',
    });
    const list = await state.notesFor({ kind: 'folder', path: 'Fic' });
    expect(list).toMatchObject({ heading: 'Fic', book: false });
    expect(list.notes.map((n) => n.path)).toEqual(['Fic/A.md', 'Fic/b.md']);
  });

  it('numbers a book’s chapters in the folder’s own order', async () => {
    const state = await vault({
      'Scarf/The Tear.md': '',
      'Scarf/Seventeen.md': '',
      'Scarf/Needle and Thread.md': '',
      'Scarf/.eien-folder.json': JSON.stringify({
        order: ['The Tear.md', 'Needle and Thread.md', 'Seventeen.md'],
        book: {},
      }),
    });
    const list = await state.notesFor({ kind: 'folder', path: 'Scarf' });
    expect(list.book).toBe(true);
    expect(list.notes.map((n) => `${n.ordinal} ${n.title}`)).toEqual([
      'i The Tear',
      'ii Needle and Thread',
      'iii Seventeen',
    ]);
  });

  it('opens a folder whose settings file is broken, as if it had none', async () => {
    const state = await vault({ 'F/a.md': '', 'F/.eien-folder.json': '{not json' });
    const list = await state.notesFor({ kind: 'folder', path: 'F' });
    expect(list.book).toBe(false);
    expect(list.notes).toHaveLength(1);
  });

  it('knows the names in a folder, for picking a free one', async () => {
    const state = await vault({ 'F/Untitled.md': '', 'F/G/x.md': '', 'Top.md': '' });
    expect(state.namesIn('F').sort()).toEqual(['G', 'Untitled.md']);
    expect(state.namesIn('').sort()).toEqual(['F', 'Top.md']);
  });

  it('finds folders at any depth, and nothing for a path that isn’t there', async () => {
    const state = await vault({ 'a/b/c/note.md': '' });
    expect(findFolder(state.tree, 'a/b/c')?.name).toBe('c');
    expect(findFolder(state.tree, 'a/x')).toBeUndefined();
  });
});

describe('when', () => {
  const now = new Date(2026, 9, 19, 16, 40);
  it('shows the time today, "yesterday", the date this year, and the year before', () => {
    expect(when(new Date(2026, 9, 19, 9, 5).getTime(), now, 'en-GB')).toBe('09:05');
    expect(when(new Date(2026, 9, 18, 23, 59).getTime(), now, 'en-GB')).toBe('yesterday');
    expect(when(new Date(2026, 9, 12).getTime(), now, 'en-US')).toBe('Oct 12');
    expect(when(new Date(2025, 9, 12).getTime(), now, 'en-US')).toBe('Oct 12, 2025');
  });

  it('counts yesterday across a month and a year boundary', () => {
    expect(when(new Date(2026, 9, 31, 22).getTime(), new Date(2026, 10, 1, 8), 'en-GB')).toBe(
      'yesterday',
    );
    expect(when(new Date(2025, 11, 31, 22).getTime(), new Date(2026, 0, 1, 8), 'en-GB')).toBe(
      'yesterday',
    );
  });
});
