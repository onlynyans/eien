import { describe, expect, it } from 'vitest';
import { VaultIndex } from '../../platform/index';
import { MemoryStorage } from '../../platform/memory/memory-storage';
import { when } from '../list/when';
import { findFolder, type Selection, VaultState } from './vault-state';

/** A vault's state over the real index, as the main process serves it. */
async function vault(files: Record<string, string>) {
  const storage = new MemoryStorage();
  for (const [path, text] of Object.entries(files)) storage.put(path, text);
  const index = new VaultIndex(storage);
  await index.refresh();
  const state = new VaultState(
    {
      list: async () => index.entries(),
      notes: async () => index.notes(),
      search: async (query, within) => index.search(query, undefined, within),
      read: (path) => storage.read(path),
    },
    'Ink & Ash',
  );
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
    expect(list).toMatchObject({ heading: 'Fic', kind: 'folder' });
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
    expect(list.kind).toBe('book');
    expect(list.notes.map((n) => `${n.ordinal} ${n.title}`)).toEqual([
      'i The Tear',
      'ii Needle and Thread',
      'iii Seventeen',
    ]);
  });

  it('lists each note with its preview and words', async () => {
    const state = await vault({ 'Seventeen.md': '# Seventeen\n\n"Look," he **begins**.' });
    const list = await state.notesFor({ kind: 'all' });
    expect(list.notes[0]).toMatchObject({
      title: 'Seventeen',
      preview: '"Look," he begins.',
      words: 4,
    });
  });

  it('builds the tag tree, and lists a tag’s notes and those under it, newest first', async () => {
    const state = await vault({
      'a.md': '#fic/aot first',
      'b.md': '---\ntags: [Fic]\n---\nsecond',
      'c.md': '#ficlet not the same',
      'd.md': 'no tags',
    });
    expect(state.tags.map((tag) => `${tag.tag}:${tag.count}`)).toEqual(['fic:2', 'ficlet:1']);
    const list = await state.notesFor({ kind: 'tag', key: 'fic' });
    expect(list).toMatchObject({ kind: 'tag', heading: '#fic', total: 2 });
    expect(list.notes.map((n) => n.path)).toEqual(['b.md', 'a.md']);
    const nested = await state.notesFor({ kind: 'tag', key: 'fic/aot' });
    expect(nested.notes.map((n) => n.path)).toEqual(['a.md']);
  });

  it('lists a tag that’s gone as empty, under its key', async () => {
    const state = await vault({ 'a.md': 'no tags' });
    const list = await state.notesFor({ kind: 'tag', key: 'vanished' });
    expect(list).toMatchObject({ heading: '#vanished', total: 0, notes: [] });
  });

  it('searches, with the words around the match as the preview', async () => {
    const state = await vault({
      'Seventeen.md': 'He mends the scarf.',
      'Ideas.md': 'Snow on the walls.',
    });
    const found = await state.search('  scarf ');
    expect(found).toMatchObject({ kind: 'search', heading: '“scarf”', total: 1 });
    expect(found.notes[0]).toMatchObject({
      path: 'Seventeen.md',
      preview: 'He mends the scarf.',
      words: 4,
    });
    expect((await state.search('nothing-here')).total).toBe(0);
  });

  it('searches only the notes a list holds, when given that list', async () => {
    const state = await vault({
      'Scarf.md': 'A scarf.',
      'Fic/Mended.md': 'The scarf, mended. #draft',
      'Fic/Deeper/Knit.md': 'A scarf, knitted.',
      'Other.md': 'Another scarf. #draft',
      '.eien/pinned.json': '["Scarf.md", "Fic/Deeper/Knit.md"]',
    });
    const found = async (selection: Selection | null) => {
      const list = await state.search('scarf', selection);
      return { within: list.within, paths: list.notes.map((note) => note.path).sort() };
    };
    const everything = ['Fic/Deeper/Knit.md', 'Fic/Mended.md', 'Other.md', 'Scarf.md'];
    // A folder's list holds its own notes, not its subfolders'.
    expect(await found({ kind: 'folder', path: 'Fic' })).toEqual({
      within: 'Fic',
      paths: ['Fic/Mended.md'],
    });
    expect(await found({ kind: 'tag', key: 'draft' })).toEqual({
      within: '#draft',
      paths: ['Fic/Mended.md', 'Other.md'],
    });
    expect(await found({ kind: 'pinned' })).toEqual({
      within: 'Pinned',
      paths: ['Fic/Deeper/Knit.md', 'Scarf.md'],
    });
    expect(await found({ kind: 'all' })).toEqual({ within: 'All Notes', paths: everything });
    // From the sidebar: the whole vault, narrowed to nothing.
    expect(await found(null)).toEqual({ within: undefined, paths: everything });
    expect((await state.search('knitted', { kind: 'folder', path: 'Fic' })).total).toBe(0);
  });

  it('names each list, as its heading and its search field say it', async () => {
    const state = await vault({ 'Fic/a.md': '#Draft', 'b.md': '' });
    expect(state.nameOf({ kind: 'all' })).toBe('All Notes');
    expect(state.nameOf({ kind: 'pinned' })).toBe('Pinned');
    expect(state.nameOf({ kind: 'tag', key: 'draft' })).toBe('#Draft');
    expect(state.nameOf({ kind: 'folder', path: 'Fic' })).toBe('Fic');
    expect(state.nameOf({ kind: 'folder', path: '' })).toBe('Ink & Ash');
    expect(state.nameOf({ kind: 'folder', path: 'Gone' })).toBe('Ink & Ash');
  });

  it('opens a folder whose settings file is broken, as if it had none', async () => {
    const state = await vault({ 'F/a.md': '', 'F/.eien-folder.json': '{not json' });
    const list = await state.notesFor({ kind: 'folder', path: 'F' });
    expect(list.kind).toBe('folder');
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
