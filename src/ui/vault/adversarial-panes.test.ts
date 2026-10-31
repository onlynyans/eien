// Adversarial: two panes (phase 6c) over a vault in memory — the tree's notes
// after a folder is renamed, moved or trashed; rows whose names look alike;
// and the drawer's turns when a slow search is overtaken.

import { describe, expect, it, vi } from 'vitest';
import type { VaultBridge } from '../../platform/bridge';
import { VaultIndex } from '../../platform/index';
import { MemoryStorage } from '../../platform/memory/memory-storage';
import type { ContentsModel } from '../list/contents-list';
import type { FoundModel } from '../list/found-rows';
import type { SidebarModel } from '../sidebar/sidebar';
import { openId, selectionOf } from '../sidebar/tree';
import { Navigation } from './navigation';
import { Organizer } from './organize';
import { type DrawnParts, PaneDrawer } from './pane-drawer';
import { treeNotes } from './tree-notes';
import { type Selection, VaultState } from './vault-state';

/** A vault in memory, as the window sees it, with an Organizer; `searchDelay` slows a search. */
async function vaultWith(
  files: Record<string, string>,
  searchDelay: (query: string) => number = () => 0,
) {
  const storage = new MemoryStorage();
  for (const [path, text] of Object.entries(files)) storage.put(path, text);
  const index = new VaultIndex(storage);
  const vault: VaultBridge = {
    current: async () => ({ name: 'V' }),
    choose: async () => null,
    importFolder: async () => null,
    writeNew: async () => true,
    list: async () => index.entries(),
    notes: async () => index.notes(),
    search: async (query) => {
      await new Promise((done) => setTimeout(done, searchDelay(query)));
      return index.search(query);
    },
    listFiles: (folder) => storage.listFiles(folder),
    read: (path) => storage.read(path),
    readBytes: (path) => storage.readBytes(path),
    write: async (path, text, expected) => {
      const result = await storage.write(path, text, expected);
      if (result.ok) await index.refresh([path]);
      return result;
    },
    move: async (from, to) => {
      const result = await storage.move(from, to);
      if (result.ok) await index.refresh([from, to]);
      return result;
    },
    trash: async (path) => {
      await storage.trash(path);
      await index.refresh([path]);
    },
    makeFolder: async (path) => {
      await storage.makeFolder(path);
      await index.refresh([path]);
    },
    onChange: () => () => {},
  };
  const state = new VaultState(vault, 'V');
  const told: string[] = [];
  const organizer = new Organizer({
    vault,
    state,
    trashName: 'the trash',
    sessions: () => [],
    closed: () => {},
    tell: (message) => told.push(message),
  });
  await index.refresh();
  await state.refresh();
  return { state, organizer, told };
}

const titles = (lists: Map<string, { notes: readonly { title: string }[] }>, id: string) =>
  lists.get(id)?.notes.map((note) => note.title);

const FILES = {
  'Fic/Scarf/The Tear.md': 'The scarf catches. #winter',
  'Fic/Scarf/Needle.md': 'A sewing kit.',
  'Fic/Loose.md': 'loose',
  'Research/Wool.md': 'Knitted wool runs.',
  '#drafts/Draft.md': 'a folder named like a tag',
  'Ideas.md': 'Snow on the walls. #drafts',
};

describe('the tree’s notes after a folder open in it changes', () => {
  it('a renamed folder, and an open folder inside it, list their notes under the new names', async () => {
    const v = await vaultWith(FILES);
    const nav = new Navigation();
    nav.chooseAndToggle({ kind: 'folder', path: 'Fic/Scarf' }); // opens Fic and Fic/Scarf
    const to = await v.organizer.renameFolder('Fic', 'Fiction');
    expect(to).toBe('Fiction');
    if (to) nav.follow('Fic', to);
    await v.state.refresh();
    const lists = await treeNotes(v.state, nav.open, 'roman');
    expect([...lists.keys()].sort()).toEqual(['', 'Fiction', 'Fiction/Scarf']);
    expect(titles(lists, 'Fiction')).toEqual(['Loose']);
    expect(titles(lists, 'Fiction/Scarf')?.sort()).toEqual(['Needle', 'The Tear']);
    expect(nav.selection).toEqual({ kind: 'folder', path: 'Fiction/Scarf' });
  });

  it('a folder moved into another (Move to…) keeps its notes listed where it went', async () => {
    const v = await vaultWith(FILES);
    const nav = new Navigation();
    nav.chooseAndToggle({ kind: 'folder', path: 'Research' });
    nav.chooseAndToggle({ kind: 'folder', path: 'Fic' });
    const to = await v.organizer.moveInto('Research', 'Fic', false);
    expect(to).toBe('Fic/Research');
    if (to) nav.follow('Research', to);
    await v.state.refresh();
    const lists = await treeNotes(v.state, nav.open, 'roman');
    expect(titles(lists, 'Fic/Research')).toEqual(['Wool']);
    expect(lists.has('Research')).toBe(false);
  });

  it('renaming the folder "#drafts" never touches the tag drafts’ open row, nor the reverse', async () => {
    const v = await vaultWith(FILES);
    const nav = new Navigation();
    nav.chooseAndToggle({ kind: 'folder', path: '#drafts' });
    nav.chooseAndToggle({ kind: 'tag', key: 'drafts' });
    const to = await v.organizer.renameFolder('#drafts', 'Old drafts');
    if (to) nav.follow('#drafts', to);
    await v.state.refresh();
    const lists = await treeNotes(v.state, nav.open, 'roman');
    expect(titles(lists, 'Old drafts')).toEqual(['Draft']);
    expect(titles(lists, openId({ kind: 'tag', key: 'drafts' }))).toEqual(['Ideas']);
  });

  it('a trashed open folder lists nothing, and choosing falls back to All Notes', async () => {
    const v = await vaultWith(FILES);
    const nav = new Navigation();
    nav.chooseAndToggle({ kind: 'folder', path: 'Fic/Scarf' });
    expect(await v.organizer.trash('Fic')).toBe(true);
    nav.unselect('Fic');
    await v.state.refresh();
    const lists = await treeNotes(v.state, nav.open, 'roman');
    expect([...lists.keys()]).toEqual(['']);
    expect(nav.selection).toEqual({ kind: 'all' });
  });

  it('a refused rename leaves the open rows and the selection as they were', async () => {
    const v = await vaultWith(FILES);
    const nav = new Navigation();
    nav.chooseAndToggle({ kind: 'folder', path: 'Research' });
    expect(await v.organizer.renameFolder('Research', 'fic')).toBeNull(); // "Fic", case aside
    expect(v.told).toEqual(['Something here already has that name.']);
    expect([...nav.open]).toEqual(['Research']);
    expect(nav.selection).toEqual({ kind: 'folder', path: 'Research' });
  });
});

describe('openId and selectionOf, on names that look like each other', () => {
  it('give back every row they were given, whatever its name', () => {
    const rows: Selection[] = [
      { kind: 'all' },
      { kind: 'pinned' },
      { kind: 'folder', path: '' },
      { kind: 'folder', path: 'all' },
      { kind: 'folder', path: 'pinned' },
      { kind: 'folder', path: '#drafts' },
      { kind: 'folder', path: '#drafts/#all' },
      { kind: 'folder', path: 'a b/ c ' },
      { kind: 'folder', path: 'Café/日本' },
      { kind: 'tag', key: 'drafts' },
      { kind: 'tag', key: 'all' },
      { kind: 'tag', key: 'a/b/c' },
      { kind: 'tag', key: '#' },
    ];
    const ids = rows.map(openId);
    expect(new Set(ids).size).toBe(rows.length);
    for (const [i, row] of rows.entries()) expect(selectionOf(ids[i] as string)).toEqual(row);
  });
});

/** No book on any page. */
const NO_EPUBS = {
  shelf: () => ({ current: null, contents: null }),
  contents: () => null,
  showsBook: () => false,
  syncFound: () => {},
  actions: { openEpub: () => {}, chapter: () => {} },
};

/** A PaneDrawer whose sidebar records each model drawn; the list stays out of sight. */
function drawer(state: VaultState, nav: Navigation, two: boolean) {
  const drawn: SidebarModel[] = [];
  const parts = {
    state,
    nav,
    panes: { two, isShut: (pane: string) => pane === 'list' },
    settings: { values: { 'books.numerals': 'roman', 'appearance.scheme': 'system' } },
    sidebar: { draw: (model: SidebarModel) => drawn.push(model), drawLens: () => {} },
    list: null,
    notice: { text: null },
    listActions: null,
    shown: () => ({ active: null, other: null }),
    pageNews: () => {},
    placeSearch: () => {},
    epubs: NO_EPUBS,
  } as unknown as DrawnParts;
  return { draw: new PaneDrawer(parts), drawn };
}

describe('the sidebar’s draws, when a slow search is overtaken', () => {
  it('a search cleared while it’s still running never brings its results back', async () => {
    const v = await vaultWith(FILES, (query) => (query === 'wool' ? 60 : 0));
    const nav = new Navigation();
    const { draw, drawn } = drawer(v.state, nav, true);
    nav.query = 'wool';
    const slow = draw.sidebar();
    nav.query = '';
    await draw.sidebar();
    await slow;
    expect(drawn).toHaveLength(1);
    expect(drawn.at(-1)?.results).toBeNull();
  });

  it('the words typed last win over a slower search typed before them', async () => {
    const v = await vaultWith(FILES, (query) => (query === 'sc' ? 80 : 5));
    const nav = new Navigation();
    const { draw, drawn } = drawer(v.state, nav, false);
    nav.query = 'sc';
    const slow = draw.sidebar();
    nav.query = 'scarf';
    await Promise.all([slow, draw.sidebar()]);
    expect(drawn.map((model) => model.results?.notes.map((note) => note.title))).toEqual([
      ['The Tear'],
    ]);
  });

  it('a draw that started with two panes is dropped once a draw with three has started', async () => {
    const v = await vaultWith(FILES, () => 40);
    const nav = new Navigation();
    nav.query = 'wool';
    const parts = { two: true };
    const drawn: SidebarModel[] = [];
    const draw = new PaneDrawer({
      state: v.state,
      nav,
      panes: {
        get two() {
          return parts.two;
        },
        isShut: () => parts.two,
      },
      settings: { values: { 'books.numerals': 'roman', 'appearance.scheme': 'system' } },
      sidebar: { draw: (model: SidebarModel) => drawn.push(model), drawLens: () => {} },
      notice: { text: null },
      shown: () => ({ active: null, other: null }),
      pageNews: () => {},
      placeSearch: () => {},
      epubs: NO_EPUBS,
    } as unknown as DrawnParts);
    const first = draw.sidebar();
    parts.two = false;
    await Promise.all([first, draw.sidebar()]);
    expect(drawn).toHaveLength(1);
    expect(drawn[0]?.two).toBe(false);
    expect(drawn[0]?.results).toBeNull(); // the list shows the search now
  });
});

describe('many notes with two panes', () => {
  it('lists three thousand notes under All Notes and the vault quickly', async () => {
    const files: Record<string, string> = {};
    for (let i = 0; i < 3000; i++) files[`Note ${i}.md`] = `Words of note ${i}. #many`;
    const v = await vaultWith(files);
    const open = new Set([openId({ kind: 'all' }), openId({ kind: 'tag', key: 'many' })]);
    const started = performance.now();
    const lists = await treeNotes(v.state, open, 'roman');
    const took = performance.now() - started;
    expect(lists.get('')?.notes).toHaveLength(3000);
    expect(lists.get('/all')?.notes).toHaveLength(3000);
    expect(lists.get('/#many')?.notes).toHaveLength(3000);
    expect(took).toBeLessThan(500);
  });
});

// #40, Phase 5c (the review): where the search field searches a book whose contents are shown.
describe('the search field beside a book’s rows', () => {
  /** A drawer over panes `shape`, a book's contents shown, recording what's asked of the book. */
  function beside(
    state: VaultState,
    nav: Navigation,
    shape: { two: boolean; listShut: boolean; phone?: boolean },
  ) {
    const drawn: SidebarModel[] = [];
    const synced: (string | null)[] = [];
    const shelves: boolean[] = [];
    const draw = new PaneDrawer({
      state,
      nav,
      panes: {
        two: shape.two,
        phone: shape.phone ?? false,
        isShut: (pane: string) => pane === 'list' && shape.listShut,
        listKept: false,
      },
      settings: { values: { 'books.numerals': 'roman', 'appearance.scheme': 'system' } },
      sidebar: { draw: (model: SidebarModel) => drawn.push(model), drawLens: () => {} },
      list: null,
      notice: { text: null },
      listActions: null,
      shown: () => ({ active: null, other: null }),
      pageNews: () => {},
      placeSearch: () => {},
      epubs: {
        ...NO_EPUBS,
        showsBook: () => true,
        syncFound: (words: string | null) => synced.push(words),
        shelf: (_two: boolean, found: boolean) => {
          shelves.push(found);
          return { current: null, contents: null };
        },
      },
    } as unknown as DrawnParts);
    return { draw, drawn, synced, shelves };
  }

  it('searches the book where its rows are beside it: the list’s band, or with two panes its SHELF row', async () => {
    const v = await vaultWith(FILES);
    const nav = new Navigation();
    expect(beside(v.state, nav, { two: false, listShut: false }).draw.searchesBook()).toBe(true);
    expect(beside(v.state, nav, { two: true, listShut: true }).draw.searchesBook()).toBe(true);
    // No book's rows beside the field: it searches the vault.
    expect(beside(v.state, nav, { two: false, listShut: true }).draw.searchesBook()).toBe(false);
    expect(
      beside(v.state, nav, { two: false, listShut: false, phone: true }).draw.searchesBook(),
    ).toBe(false);
  });

  it('with two panes, keeps the vault’s results out of the tree, and syncs the book’s search with the words', async () => {
    const v = await vaultWith(FILES);
    const nav = new Navigation();
    nav.query = 'wool';
    const { draw, drawn, synced, shelves } = beside(v.state, nav, { two: true, listShut: true });
    await draw.sidebar();
    expect(drawn.at(-1)?.results).toBeNull();
    expect(synced).toEqual(['wool']);
    expect(shelves).toEqual([true]);
  });

  it('with one pane and the list shut, searches the vault, the book’s search stopped', async () => {
    const v = await vaultWith(FILES);
    const nav = new Navigation();
    nav.query = 'wool';
    const { draw, drawn, synced } = beside(v.state, nav, { two: false, listShut: true });
    await draw.sidebar();
    expect(drawn.at(-1)?.results?.notes.length).toBeGreaterThan(0);
    expect(synced).toEqual([null]);
  });
});

describe('where the search field searches beside a book (#40, Phase 5c, as QA tried it)', () => {
  const TITLE = 'Pride and Prejudice';
  const FOUND: FoundModel = {
    rows: [
      {
        spine: 1,
        from: 4,
        to: 10,
        before: 'Mr. ',
        words: 'Bennet',
        after: ' replied',
        page: '2',
        chapter: 'Chapter I',
      },
    ],
    words: 'Bennet',
    title: TITLE,
    searched: 3,
    chapters: 3,
    done: true,
    more: false,
  };

  /** A drawer over `files` with a book's contents chosen (or none), each call to the book's parts kept. */
  async function drawerWith(
    layout: { two?: boolean; phone?: boolean; shut?: readonly string[] },
    book = true,
  ) {
    const v = await vaultWith({ 'Bennet.md': 'Mr. Bennet, a note about him.' });
    const nav = new Navigation();
    nav.query = 'Bennet';
    const search = vi.spyOn(v.state, 'search');
    /** What the book's search was synced to before each draw: the field's words, or null (stopped). */
    const asked: (string | null)[] = [];
    const shelves: [boolean, boolean][] = [];
    const placed: [boolean, string][] = [];
    const drawn: SidebarModel[] = [];
    const goFound = vi.fn();
    const contents = (withFound = false) => {
      if (!book) return null;
      const words = withFound ? asked.at(-1) : null;
      const model: ContentsModel = {
        title: TITLE,
        author: '',
        rows: [{ title: 'Chapter I', depth: 0, spine: 1 }],
        spine: 1,
        lens: 'contents',
        // Marks on the edge: Found's rows take the contents' place while there are words.
        marks: null,
        found: words?.trim() ? FOUND : null,
      };
      return { ...model, side: { path: 'Novels/P.epub' } };
    };
    const list = document.createElement('section');
    const shut = layout.shut ?? [];
    const draw = new PaneDrawer({
      state: v.state,
      nav,
      panes: {
        two: layout.two ?? false,
        phone: layout.phone ?? false,
        listKept: !shut.includes('list'),
        isShut: (pane: string) => shut.includes(pane),
      },
      settings: { values: { 'books.numerals': 'roman', 'appearance.scheme': 'system' } },
      sidebar: { draw: (model: SidebarModel) => drawn.push(model), drawLens: () => {} },
      list,
      notice: { text: null },
      listActions: {},
      shown: () => ({ active: null, other: null }),
      pageNews: () => {},
      arrange: () => ({ mode: false, on: false }),
      placeSearch: (inList: boolean, name: string) => placed.push([inList, name]),
      epubs: {
        contents,
        showsBook: () => book,
        syncFound: (words: string | null) => asked.push(words),
        shelf: (two: boolean, found: boolean) => {
          shelves.push([two, found]);
          return { current: null, contents: null };
        },
        actions: { openEpub: () => {}, chapter: () => {}, goFound },
      },
    } as unknown as DrawnParts);
    return { draw, nav, search, asked, shelves, placed, drawn, list, goFound };
  }

  it('with two panes, searches the book: its Found under its SHELF row, the vault never searched', async () => {
    const at = await drawerWith({ two: true, shut: ['list'] });
    expect(at.draw.searchesBook()).toBe(true);
    await at.draw.all();
    expect(at.search).not.toHaveBeenCalled();
    expect(at.drawn.at(-1)?.results).toBeNull();
    expect(at.shelves.at(-1)).toEqual([true, true]);
    expect(at.asked.at(-1)).toBe('Bennet');
    // The field named for the book it searches, in the sidebar.
    expect(at.placed.at(-1)).toEqual([false, TITLE]);
  });

  it('with the list in sight, searches the book: Found in the list, a row going to its match', async () => {
    const at = await drawerWith({ two: false });
    expect(at.draw.searchesBook()).toBe(true);
    await at.draw.all();
    expect(at.search).not.toHaveBeenCalled();
    expect(at.asked).toContain('Bennet');
    expect(at.placed.at(-1)).toEqual([true, TITLE]);
    const row = at.list.querySelector<HTMLButtonElement>('.found-row');
    expect(row?.textContent).toContain('Mr. Bennet replied');
    row?.click();
    expect(at.goFound).toHaveBeenCalledWith('Novels/P.epub', FOUND.rows[0]);
    // The sidebar's book row says the contents are elsewhere (in the list), its words the book's.
    expect(at.drawn.at(-1)?.elsewhere).toBe(true);
    expect(at.shelves.at(-1)).toEqual([false, true]);
  });

  it('with one pane and the list shut, searches the vault: no book’s rows are beside the field', async () => {
    const at = await drawerWith({ two: false, shut: ['list'] });
    expect(at.draw.searchesBook()).toBe(false);
    await at.draw.sidebar();
    expect(at.search).toHaveBeenCalledWith('Bennet');
    expect(at.drawn.at(-1)?.results?.notes.map((note) => note.title)).toEqual(['Bennet']);
    expect(at.shelves.at(-1)).toEqual([false, false]);
    expect(at.asked.at(-1)).toBeNull();
    expect(at.placed.at(-1)).toEqual([false, 'V']);
    expect(at.drawn.at(-1)?.elsewhere).toBe(false);
  });

  it('on a phone, with the book’s contents in sight, searches the vault, the book’s words never asked', async () => {
    const at = await drawerWith({ phone: true });
    expect(at.draw.searchesBook()).toBe(false);
    await at.draw.list();
    expect(at.search).toHaveBeenCalledWith('Bennet', null, false);
    expect(at.asked.filter((words) => typeof words === 'string')).toEqual([]);
    expect(at.list.querySelector('.found-row')).toBeNull();
    expect(at.list.querySelector('.note-row')?.textContent).toContain('Bennet');
    expect(at.placed.at(-1)).toEqual([false, 'V']);
  });

  it('with no book’s contents chosen, searches notes as before, however the panes stand', async () => {
    for (const layout of [{ two: true, shut: ['list'] }, { two: false }]) {
      const at = await drawerWith(layout, false);
      expect(at.draw.searchesBook()).toBe(false);
    }
  });

  it('names the book in the field with nothing typed, its contents shown', async () => {
    const at = await drawerWith({ two: false });
    at.nav.query = '';
    await at.draw.list();
    expect(at.placed.at(-1)).toEqual([true, TITLE]);
    expect(at.list.querySelector('.contents-row')?.textContent).toBe('Chapter I');
  });
});
