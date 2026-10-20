import { describe, expect, it } from 'vitest';
import { VaultIndex } from '../../platform/index';
import { MemoryStorage } from '../../platform/memory/memory-storage';
import { openId } from '../sidebar/tree';
import { treeNotes } from './tree-notes';
import { VaultState } from './vault-state';

async function stateWith(files: Record<string, string>): Promise<VaultState> {
  const storage = new MemoryStorage();
  for (const [path, text] of Object.entries(files)) storage.put(path, text);
  const index = new VaultIndex(storage);
  await index.refresh();
  const state = new VaultState(
    {
      list: async () => index.entries(),
      notes: async () => index.notes(),
      search: async (query) => index.search(query),
      read: (path) => storage.read(path),
    },
    'V',
  );
  await state.refresh();
  return state;
}

const titles = (lists: Map<string, { notes: readonly { title: string }[] }>, id: string) =>
  lists.get(id)?.notes.map((note) => note.title);

describe('treeNotes', () => {
  const files = {
    'Loose.md': 'loose #fic',
    'Book/B.md': 'b',
    'Book/A.md': 'a #fic',
    'Book/.eien-folder.json': '{"order":["B.md","A.md"],"book":{}}',
    '#drafts/Draft.md': 'a folder whose name starts with #',
    '.eien/pinned.json': '["Book/A.md"]',
  };

  it('always lists the vault’s own notes, and only the rows that are open', async () => {
    const lists = await treeNotes(await stateWith(files), new Set(), 'roman');
    expect([...lists.keys()]).toEqual(['']);
    expect(titles(lists, '')).toEqual(['Loose']);
  });

  it('lists an open book in its own order, numbered', async () => {
    const lists = await treeNotes(await stateWith(files), new Set(['Book']), 'arabic');
    expect(titles(lists, 'Book')).toEqual(['B', 'A']);
    expect(lists.get('Book')?.notes.map((note) => note.ordinal)).toEqual(['1', '2']);
  });

  it('lists All Notes, Pinned and a tag under their own ids', async () => {
    const open = new Set([
      openId({ kind: 'all' }),
      openId({ kind: 'pinned' }),
      openId({ kind: 'tag', key: 'fic' }),
    ]);
    const lists = await treeNotes(await stateWith(files), open, 'roman');
    expect(lists.get('/all')?.notes).toHaveLength(4);
    expect(titles(lists, '/pinned')).toEqual(['A']);
    expect(titles(lists, '/#fic')?.sort()).toEqual(['A', 'Loose']);
  });

  it('never takes a folder named "#drafts" for the tag "drafts"', async () => {
    const open = new Set(['#drafts', openId({ kind: 'tag', key: 'drafts' })]);
    const lists = await treeNotes(await stateWith(files), open, 'roman');
    expect(titles(lists, '#drafts')).toEqual(['Draft']);
    expect(titles(lists, '/#drafts')).toEqual([]);
  });

  it('lists nothing for an open folder that’s gone, or an id that names no row', async () => {
    const open = new Set(['Gone', 'Book/Gone', '/', '/#', '/nonsense']);
    const lists = await treeNotes(await stateWith(files), open, 'roman');
    expect([...lists.keys()]).toEqual(['']);
  });
});
