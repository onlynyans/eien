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

  describe('a folder with its subfolders’ notes (backlog #42)', () => {
    const fic = () =>
      vault({
        'Fic/Own b.md': '',
        'Fic/Own a.md': '#draft',
        'Fic/Arc 1/Knit.md': '#draft',
        'Fic/Arc 1/Cast on.md': '',
        'Fic/Arc 1/Cut/Dropped.md': '#draft',
        'Fic/Arc 2/Bind off.md': 'The scarf, bound off.',
        'Fic/Empty/.keep': '',
        'Fic/.eien-folder.json': JSON.stringify({ order: ['Arc 2', 'Arc 1', 'Own b.md'] }),
        'Fic/Arc 1/.eien-folder.json': JSON.stringify({ order: ['Knit.md', 'Cast on.md'] }),
        'Other.md': 'Another scarf.',
      });
    const paths = (list: { notes: readonly { path: string }[] }) =>
      list.notes.map((note) => note.path);

    it('lists its own notes first, then each subfolder’s, at every depth, in your order', async () => {
      const state = await fic();
      const list = await state.notesFor(
        { kind: 'folder', path: 'Fic' },
        'roman',
        'order',
        undefined,
        true,
      );
      expect(paths(list)).toEqual([
        'Fic/Own b.md',
        'Fic/Own a.md',
        'Fic/Arc 2/Bind off.md',
        'Fic/Arc 1/Knit.md',
        'Fic/Arc 1/Cast on.md',
        'Fic/Arc 1/Cut/Dropped.md',
      ]);
      expect(list.nested).toBe(true);
      expect(list.total).toBe(6);
      expect(list.groups?.map((group) => group.name)).toEqual([
        'Arc 2',
        'Arc 1',
        'Arc 1 / Cut',
        'Empty',
      ]);
    });

    it('sorts within each group, the groups staying in your order', async () => {
      const state = await fic();
      const list = await state.notesFor(
        { kind: 'folder', path: 'Fic' },
        'roman',
        'title',
        undefined,
        true,
      );
      expect(paths(list)).toEqual([
        'Fic/Own a.md',
        'Fic/Own b.md',
        'Fic/Arc 2/Bind off.md',
        'Fic/Arc 1/Cast on.md',
        'Fic/Arc 1/Knit.md',
        'Fic/Arc 1/Cut/Dropped.md',
      ]);
    });

    it('filters across the groups, counting how many of how many', async () => {
      const state = await fic();
      const list = await state.notesFor(
        { kind: 'folder', path: 'Fic' },
        'roman',
        'order',
        { tags: [['draft', 'in']], match: 'all' },
        true,
      );
      expect(paths(list)).toEqual([
        'Fic/Own a.md',
        'Fic/Arc 1/Knit.md',
        'Fic/Arc 1/Cut/Dropped.md',
      ]);
      expect([list.total, list.of]).toEqual([3, 6]);
    });

    it('off, is the folder’s own notes as before; with no subfolders, has no toggle', async () => {
      const state = await fic();
      const off = await state.notesFor(
        { kind: 'folder', path: 'Fic' },
        'roman',
        'order',
        undefined,
        false,
      );
      expect(paths(off)).toEqual(['Fic/Own b.md', 'Fic/Own a.md']);
      expect([off.nested, off.groups]).toEqual([false, undefined]);
      const leaf = await state.notesFor(
        { kind: 'folder', path: 'Fic/Arc 2' },
        'roman',
        undefined,
        undefined,
        true,
      );
      expect([leaf.nested, leaf.groups]).toEqual([undefined, undefined]);
      // The tree's lists never ask: no toggle there.
      expect((await state.notesFor({ kind: 'folder', path: 'Fic' })).nested).toBeUndefined();
    });

    it('searches the subfolders’ notes too, the hits in their groups', async () => {
      const state = await fic();
      const list = await state.search('scarf', { kind: 'folder', path: 'Fic' }, true);
      expect(paths(list)).toEqual(['Fic/Arc 2/Bind off.md']);
      expect(list.groups?.map((group) => group.path)).toContain('Fic/Arc 2');
      expect(paths(await state.search('scarf', { kind: 'folder', path: 'Fic' }))).toEqual([]);
    });
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

  it('knows which folders are books, and sees one made or unmade', async () => {
    const storage = new MemoryStorage();
    const settings = (book: boolean) =>
      JSON.stringify({ order: [], ...(book ? { book: {} } : {}) });
    storage.put('Fic/Scarf/The Tear.md', '');
    storage.put('Fic/Scarf/.eien-folder.json', settings(true));
    storage.put('Fic/Walls/Gate.md', '');
    storage.put('Fic/Walls/.eien-folder.json', settings(false));
    storage.put('Research/Wool.md', '');
    storage.put('Broken/.eien-folder.json', '{ not json');
    const index = new VaultIndex(storage);
    await index.refresh();
    const state = new VaultState(
      {
        list: async () => index.entries(),
        notes: async () => index.notes(),
        search: async (query) => index.search(query),
        read: (path) => {
          if (path.endsWith('.eien-folder.json')) reads.push(path);
          return storage.read(path);
        },
      },
      'V',
    );
    const reads: string[] = [];
    await state.refresh();
    expect([...state.books]).toEqual(['Fic/Scarf']);

    // Nothing named as changed: no folder's settings are read again.
    reads.length = 0;
    await state.refresh();
    expect(reads).toEqual([]);

    // The watcher names both settings files: both are read again, and nothing else.
    storage.put('Fic/Scarf/.eien-folder.json', settings(false));
    storage.put('Fic/Walls/.eien-folder.json', settings(true));
    await index.refresh();
    await state.refresh(['Fic/Scarf/.eien-folder.json', 'Fic/Walls/.eien-folder.json', 'X.md']);
    expect([...state.books]).toEqual(['Fic/Walls']);
    expect(reads.sort()).toEqual(['Fic/Scarf/.eien-folder.json', 'Fic/Walls/.eien-folder.json']);

    // A folder renamed is a new folder: its settings are read there, and the old path forgotten.
    expect((await storage.move('Fic/Walls', 'Fic/Gates')).ok).toBe(true);
    await index.refresh();
    reads.length = 0;
    await state.refresh();
    expect([...state.books]).toEqual(['Fic/Gates']);
    expect(reads).toEqual(['Fic/Gates/.eien-folder.json']);
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
