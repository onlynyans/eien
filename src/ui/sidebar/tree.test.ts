// The sidebar's rows as drawn: Library, folders and tags, with two panes the
// notes under each open row, and the note rows kept from one draw to the next.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TagNode } from '../../core/tags';
import type { FolderNode } from '../../core/vault';
import type { ListedNote, NoteList } from '../vault/vault-state';
import { RowCache } from './row-cache';
import { openId, RESULTS, selectionOf, type TreeActions, type TreeModel, TreeRows } from './tree';

const folderNode = (
  path: string,
  folders: FolderNode[] = [],
  notes: string[] = [],
): FolderNode => ({
  name: path.split('/').at(-1) ?? '',
  path,
  folders,
  notes,
  noteCount: notes.length + folders.reduce((sum, each) => sum + each.noteCount, 0),
});

const note = (path: string, extra: Partial<ListedNote> = {}): ListedNote => ({
  path,
  title: path,
  modified: 0,
  words: 0,
  preview: '',
  ...extra,
});

const listOf = (notes: ListedNote[], extra: Partial<NoteList> = {}): NoteList => ({
  kind: 'folder',
  heading: '',
  notes,
  total: notes.length,
  sorts: [],
  ...extra,
});

const tag = (name: string, count: number, children: TagNode[] = []): TagNode => ({
  name,
  tag: name,
  key: name,
  count,
  children,
});

const actions = () =>
  ({
    open: vi.fn(),
    menu: vi.fn(),
    rename: vi.fn(),
    trash: vi.fn(),
    nudge: vi.fn(),
    select: vi.fn(),
    toggle: vi.fn(),
    folderMenu: vi.fn(),
  }) satisfies TreeActions;

const drafts = folderNode(
  'Drafts',
  [folderNode('Drafts/Old', [], ['Drafts/Old/x.md'])],
  ['Drafts/a.md'],
);
const vault = folderNode('', [drafts, folderNode('Book', [], ['Book/one.md'])]);

const model = (extra: Partial<TreeModel> = {}): TreeModel => ({
  tree: vault,
  tags: [],
  pinned: 0,
  selection: { kind: 'all' },
  open: new Set(),
  two: false,
  notes: new Map(),
  results: null,
  openNote: null,
  books: new Set(),
  ...extra,
});

const draw = (rows: TreeRows) => {
  const list = document.createElement('ul');
  list.append(...rows.library(), ...rows.folders(vault, 0, () => null));
  document.body.replaceChildren(list);
  return list;
};
const names = (root: Element) =>
  [...root.querySelectorAll('.tree-row__name')].map((each) => (each as HTMLElement).dataset.key);
const byKey = (root: Element, key: string) =>
  root.querySelector<HTMLButtonElement>(`[data-key="${CSS.escape(key)}"]`) as HTMLButtonElement;

beforeEach(() => {
  document.body.replaceChildren();
});

describe('openId and selectionOf', () => {
  it('name each row so a folder named like a tag or a Library row is never taken for one', () => {
    for (const path of ['#drafts', 'all', 'pinned', 'a/b']) {
      expect(selectionOf(openId({ kind: 'folder', path }))).toEqual({ kind: 'folder', path });
    }
    expect(selectionOf(openId({ kind: 'tag', key: 'fic/aot' }))).toEqual({
      kind: 'tag',
      key: 'fic/aot',
    });
    expect(selectionOf(openId({ kind: 'all' }))).toEqual({ kind: 'all' });
    expect(selectionOf(openId({ kind: 'pinned' }))).toEqual({ kind: 'pinned' });
    expect(selectionOf('/#')).toBeNull();
    expect(selectionOf('/elsewhere')).toBeNull();
  });
});

describe('TreeRows, three panes', () => {
  it('lists All Notes, then Pinned only when something is pinned, with counts', () => {
    const none = new TreeRows(model(), actions(), () => ({}), new RowCache());
    expect(none.library().map((row) => row.textContent)).toEqual(['All Notes3']);
    const some = new TreeRows(model({ pinned: 2 }), actions(), () => ({}), new RowCache());
    expect(some.library().map((row) => row.textContent)).toEqual(['All Notes3', 'Pinned2']);
  });

  it('lists the folders, an open one’s own folders inside it, and no notes', () => {
    const shut = draw(new TreeRows(model(), actions(), () => ({}), new RowCache()));
    expect(names(shut)).toEqual(['all', 'folder:Drafts', 'folder:Book']);

    const open = draw(
      new TreeRows(model({ open: new Set(['Drafts']) }), actions(), () => ({}), new RowCache()),
    );
    expect(names(open)).toEqual(['all', 'folder:Drafts', 'folder:Drafts/Old', 'folder:Book']);
    expect(open.querySelectorAll('.tree-row--note')).toHaveLength(0);
    // The inner folder sits one deeper, in a group the guide line runs down.
    const inner = byKey(open, 'folder:Drafts/Old').closest('li') as HTMLElement;
    expect(inner.style.getPropertyValue('--depth')).toBe('1');
    expect(inner.closest('.tree-group')).not.toBeNull();
  });

  it('marks the row selected, and a book folder as a book', () => {
    const rows = new TreeRows(
      model({ selection: { kind: 'folder', path: 'Book' }, books: new Set(['Book']) }),
      actions(),
      () => ({}),
      new RowCache(),
    );
    const tree = draw(rows);
    expect(byKey(tree, 'folder:Book').getAttribute('aria-current')).toBe('true');
    expect(byKey(tree, 'all').hasAttribute('aria-current')).toBe(false);
    expect(byKey(tree, 'folder:Book').querySelector('.book-mark')?.textContent).toBe('Book');
    expect(byKey(tree, 'folder:Drafts').querySelector('.book-mark')).toBeNull();
  });

  it('selects a row on a click, and gives a folder the sidebar’s own keys', () => {
    const run = actions();
    const folderKeys = vi.fn();
    const tree = draw(
      new TreeRows(model(), run, (path) => ({ keydown: () => folderKeys(path) }), new RowCache()),
    );
    byKey(tree, 'folder:Drafts').click();
    byKey(tree, 'all').click();
    expect(run.select.mock.calls).toEqual([
      [{ kind: 'folder', path: 'Drafts' }],
      [{ kind: 'all' }],
    ]);
    byKey(tree, 'folder:Book').dispatchEvent(new KeyboardEvent('keydown', { key: 'F2' }));
    expect(folderKeys).toHaveBeenCalledWith('Book');
    expect(byKey(tree, 'folder:Book').getAttribute('aria-keyshortcuts')).toBe('F2');
    expect(byKey(tree, 'all').hasAttribute('aria-keyshortcuts')).toBe(false);
  });

  it('gives a folder with folders inside a twisty that opens it, named for what it does', () => {
    const run = actions();
    const tree = draw(new TreeRows(model(), run, () => ({}), new RowCache()));
    const twist = byKey(tree, 'twist:Drafts');
    expect(twist.getAttribute('aria-expanded')).toBe('false');
    expect(twist.getAttribute('aria-label')).toBe('Open Drafts');
    twist.click();
    expect(run.toggle).toHaveBeenCalledWith('Drafts');
    // Book has notes but no folders: with three panes nothing opens under it.
    expect(tree.querySelector('[data-key="twist:Book"]')).toBeNull();
  });

  it('lists tags with their # and, open, their children', () => {
    const tags = [tag('fic', 3, [tag('fic/aot', 2)])];
    const rows = new TreeRows(
      model({ tags, open: new Set([openId({ kind: 'tag', key: 'fic' })]) }),
      actions(),
      () => ({}),
      new RowCache(),
    );
    const list = document.createElement('ul');
    list.append(...rows.tags(tags, 0));
    expect(names(list)).toEqual(['tag:fic', 'tag:fic/aot']);
    expect(byKey(list, 'tag:fic').querySelector('.tree-row__hash')?.textContent).toBe('#');
    expect(byKey(list, 'twist:/#fic').getAttribute('aria-label')).toBe('Close #fic');
  });
});

describe('TreeRows, two panes', () => {
  const two = (extra: Partial<TreeModel> = {}) =>
    model({
      two: true,
      open: new Set(['/all', 'Drafts']),
      notes: new Map([
        ['/all', listOf([note('Drafts/a.md'), note('Book/one.md')])],
        ['Drafts', listOf([note('Drafts/a.md')], { folder: 'Drafts', sort: 'order' })],
      ]),
      openNote: 'Drafts/a.md',
      ...extra,
    });

  it('lists each open row’s notes under it, after its folders, each under its own key', () => {
    const tree = draw(new TreeRows(two(), actions(), () => ({}), new RowCache()));
    expect(names(tree)).toEqual([
      'all',
      'note:/all:Drafts/a.md',
      'note:/all:Book/one.md',
      'folder:Drafts',
      'folder:Drafts/Old',
      'note:Drafts:Drafts/a.md',
      'folder:Book',
    ]);
  });

  it('marks the note on the page wherever it is listed, and no row as selected', () => {
    const tree = draw(new TreeRows(two(), actions(), () => ({}), new RowCache()));
    const current = [...tree.querySelectorAll('[aria-current="true"]')].map(
      (each) => (each as HTMLElement).dataset.key,
    );
    expect(current).toEqual(['note:/all:Drafts/a.md', 'note:Drafts:Drafts/a.md']);
  });

  it('gives the Library rows and a folder with notes a twisty, and says which are open', () => {
    const tree = draw(new TreeRows(two(), actions(), () => ({}), new RowCache()));
    expect(byKey(tree, 'all').getAttribute('aria-expanded')).toBe('true');
    expect(byKey(tree, 'folder:Book').getAttribute('aria-expanded')).toBe('false');
    expect(tree.querySelector('[data-key="twist:Book"]')).not.toBeNull();
  });

  it('lets a note be moved with Alt+arrows only where its folder is in its own order', () => {
    const run = actions();
    const tree = draw(new TreeRows(two(), run, () => ({}), new RowCache()));
    const key = (row: string) =>
      byKey(tree, row).dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowUp', altKey: true }),
      );
    key('note:/all:Drafts/a.md');
    key('note:Drafts:Drafts/a.md');
    expect(run.nudge.mock.calls).toEqual([['Drafts/a.md', -1]]);
    expect(byKey(tree, 'note:Drafts:Drafts/a.md').getAttribute('aria-keyshortcuts')).toContain(
      'Alt+ArrowUp',
    );
    byKey(tree, 'note:/all:Book/one.md').click();
    expect(run.open).toHaveBeenCalledWith('Book/one.md');
  });

  it('draws a search’s results under their own key', () => {
    const rows = new TreeRows(
      model({ results: listOf([note('x.md')], { kind: 'search' }) }),
      actions(),
      () => ({}),
      new RowCache(),
    );
    expect(
      rows.noteRows(RESULTS, 0).map((row) => row.querySelector('button')?.dataset.key),
    ).toEqual(['note:results:x.md']);
  });
});

describe('RowCache', () => {
  const twoModel = (notes: ListedNote[], openNote: string | null = null) =>
    model({
      two: true,
      open: new Set(['/all']),
      notes: new Map([['/all', listOf(notes)]]),
      openNote,
    });
  const noteRowsOf = (cache: RowCache, notes: ListedNote[], openNote: string | null = null) => {
    cache.begin();
    const rows = new TreeRows(twoModel(notes, openNote), actions(), () => ({}), cache).noteRows(
      '/all',
      1,
    );
    return rows;
  };

  it('keeps a row that shows the same, and makes it again when anything it shows changed', () => {
    const cache = new RowCache();
    const [a1, b1] = noteRowsOf(cache, [note('a.md'), note('b.md')]);
    cache.settle();
    const [a2, b2] = noteRowsOf(cache, [note('a.md'), note('b.md', { title: 'Renamed' })]);
    cache.settle();
    expect(a2).toBe(a1);
    expect(b2).not.toBe(b1);
    expect(b2?.textContent).toContain('Renamed');

    const [a3] = noteRowsOf(cache, [note('a.md'), note('b.md', { title: 'Renamed' })], 'a.md');
    expect(a3).not.toBe(a2);
    expect(a3?.querySelector('[aria-current="true"]')).not.toBeNull();
  });

  it('forgets rows a draw left out', () => {
    const cache = new RowCache();
    const [a1] = noteRowsOf(cache, [note('a.md')]);
    cache.settle();
    noteRowsOf(cache, [note('b.md')]);
    cache.settle();
    const [a3] = noteRowsOf(cache, [note('a.md')]);
    expect(a3).not.toBe(a1);
  });

  it('puts a list’s rows right in place, moving only what moved, and touching nothing else', () => {
    const cache = new RowCache();
    const parent = document.createElement('ul');
    const folderRow = document.createElement('li');
    const before = noteRowsOf(cache, [note('a.md'), note('b.md'), note('c.md')]);
    parent.append(folderRow, ...before);
    document.body.append(parent);
    cache.settle();

    // c.md saved: it goes to the top of a list by newest; b.md is trashed.
    const after = noteRowsOf(cache, [note('c.md', { modified: 60_000 }), note('a.md')]);
    const [, kept] = after;
    expect(kept).toBe(before[0]);
    expect(cache.patch(() => after)).toBe(true);
    expect([...parent.children]).toEqual([folderRow, ...after]);
    expect(before[1]?.isConnected).toBe(false);
  });

  it('refuses to patch a list it can’t find, or one left with no rows, changing nothing', () => {
    const cache = new RowCache();
    const parent = document.createElement('ul');
    const before = noteRowsOf(cache, [note('a.md')]);
    parent.append(...before);
    document.body.append(parent);
    cache.settle();
    expect(cache.patch(() => [])).toBe(false);
    expect([...parent.children]).toEqual(before);

    // A list whose rows were never put in the window: nothing to find it by.
    const loose = new RowCache();
    noteRowsOf(loose, [note('a.md')]);
    loose.settle();
    expect(loose.patch(() => noteRowsOf(loose, [note('b.md')]))).toBe(false);
  });

  it('patches a list that had no rows and still has none', () => {
    const cache = new RowCache();
    noteRowsOf(cache, []);
    cache.settle();
    expect(cache.patch(() => [])).toBe(true);
  });
});
