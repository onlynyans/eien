// The note list as the window draws it: its rows, what each row answers to,
// and a redraw that keeps the keyboard where it was.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { closeMenu } from '../menu/menu';
import type { ListedNote, NoteList } from '../vault/vault-state';
import { type ListActions, renderList } from './list';

const note = (path: string, extra: Partial<ListedNote> = {}): ListedNote => ({
  path,
  title: path.replace(/\.md$/, ''),
  modified: Date.now(),
  words: 0,
  preview: `${path} begins`,
  ...extra,
});

const folder = (paths: readonly string[], extra: Partial<NoteList> = {}): NoteList => ({
  kind: 'folder',
  heading: 'Drafts',
  notes: paths.map((path) => note(path)),
  total: paths.length,
  sort: 'modified',
  sorts: ['order', 'title', 'modified'],
  folder: 'Drafts',
  ...extra,
});

const actions = () =>
  ({
    open: vi.fn(),
    menu: vi.fn(),
    rename: vi.fn(),
    trash: vi.fn(),
    nudge: vi.fn(),
    newNote: vi.fn(),
    clearSearch: vi.fn(),
    sort: vi.fn(),
    filter: vi.fn(),
    tags: vi.fn(() => []),
  }) satisfies ListActions;

let container: HTMLElement;
const rows = () => [...container.querySelectorAll<HTMLButtonElement>('.note-row')];
const row = (path: string) =>
  container.querySelector<HTMLButtonElement>(`.note-row[data-path="${path}"]`) as HTMLElement;
const key = (target: Element, init: KeyboardEventInit) =>
  target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, ...init }));

beforeEach(() => {
  container = document.createElement('section');
  document.body.replaceChildren(container);
});

afterEach(() => {
  closeMenu();
});

describe('renderList', () => {
  it('draws the heading, how many, and a row for each note, the open one marked', () => {
    renderList(container, folder(['a.md', 'b.md', 'c.md']), 'b.md', actions());
    expect(container.querySelector('h2')?.textContent).toBe('Drafts');
    expect(container.querySelector('.list__count')?.textContent).toBe('3 notes');
    expect(rows().map((each) => each.dataset.path)).toEqual(['a.md', 'b.md', 'c.md']);
    expect(rows().map((each) => each.getAttribute('aria-current'))).toEqual([null, 'true', null]);
    expect(row('a.md').querySelector('.note-row__title')?.textContent).toBe('a');
  });

  it('shows a book’s chapters with their number and words, not their time', () => {
    const book: NoteList = {
      ...folder([]),
      kind: 'book',
      notes: [note('one.md', { ordinal: 'i', words: 1200 })],
      total: 1,
    };
    renderList(container, book, null, actions());
    expect(container.querySelector('.rows')?.classList.contains('rows--book')).toBe(true);
    expect(row('one.md').querySelector('.note-row__ord')?.textContent).toBe('i');
    expect(row('one.md').querySelector('.note-row__meta')?.textContent).toBe(
      `${(1200).toLocaleString()} w`,
    );
  });

  it('says a note is empty rather than showing nothing', () => {
    const list = { ...folder([]), notes: [note('a.md', { preview: '' })], total: 1 };
    renderList(container, list, null, actions());
    const preview = row('a.md').querySelector('.note-row__preview');
    expect(preview?.textContent).toBe('Empty');
    expect(preview?.classList.contains('is-empty')).toBe(true);
  });

  it('shows its notice as a status, and hides the line with none', () => {
    renderList(container, folder(['a.md']), null, actions(), 'Moved to the trash');
    const notice = container.querySelector<HTMLElement>('.list__notice');
    expect(notice?.getAttribute('role')).toBe('status');
    expect(notice?.textContent).toBe('Moved to the trash');
    expect(notice?.hidden).toBe(false);

    renderList(container, folder(['a.md']), null, actions());
    expect(container.querySelector<HTMLElement>('.list__notice')?.hidden).toBe(true);
  });

  it('says a folder is empty, and a search that found nothing offers to clear it', () => {
    renderList(container, folder([]), null, actions());
    expect(container.querySelector('.list__empty')?.textContent).toBe('Nothing here yet.');

    const run = actions();
    const search: NoteList = { kind: 'search', heading: '“x”', notes: [], total: 0, sorts: [] };
    renderList(container, search, null, run);
    const clear = [...container.querySelectorAll('button')].find(
      (button) => button.textContent === 'Clear search',
    );
    clear?.click();
    expect(run.clearSearch).toHaveBeenCalledOnce();
    expect(container.querySelector('.list__sort')).toBeNull();
  });

  it('opens a note on a click, and New note makes one', () => {
    const run = actions();
    renderList(container, folder(['a.md', 'b.md']), null, run);
    row('b.md').click();
    expect(run.open).toHaveBeenCalledWith('b.md');
    [...container.querySelectorAll('button')].find((b) => b.textContent === 'New note')?.click();
    expect(run.newNote).toHaveBeenCalledOnce();
  });

  it('renames on F2, trashes on Ctrl+Delete or Ctrl+Backspace, and gives the menu from the keyboard', () => {
    // happy-dom's navigator is not a Mac's: the modifier is Ctrl.
    const run = actions();
    renderList(container, folder(['a.md']), null, run);
    key(row('a.md'), { key: 'F2' });
    key(row('a.md'), { key: 'Backspace', ctrlKey: true });
    key(row('a.md'), { key: 'Delete', ctrlKey: true });
    key(row('a.md'), { key: 'Backspace' });
    key(row('a.md'), { key: 'F10', shiftKey: true });
    key(row('a.md'), { key: 'ContextMenu' });
    expect(run.rename).toHaveBeenCalledWith('a.md');
    expect(run.trash).toHaveBeenCalledTimes(2);
    expect(run.menu).toHaveBeenCalledTimes(2);
    expect(run.menu.mock.calls[0]?.slice(0, 1)).toEqual(['a.md']);
  });

  it('moves a note with Alt+↑ and Alt+↓ only in its folder’s own order, and says so', () => {
    const run = actions();
    renderList(container, folder(['a.md']), null, run);
    key(row('a.md'), { key: 'ArrowDown', altKey: true });
    expect(run.nudge).not.toHaveBeenCalled();
    expect(row('a.md').getAttribute('aria-keyshortcuts')).toMatch(/^F2 (Meta|Control)\+Shift\+P$/);

    renderList(container, folder(['a.md'], { sort: 'order' }), null, run);
    key(row('a.md'), { key: 'ArrowDown', altKey: true });
    key(row('a.md'), { key: 'ArrowUp', altKey: true });
    expect(run.nudge.mock.calls).toEqual([
      ['a.md', 1],
      ['a.md', -1],
    ]);
    expect(row('a.md').getAttribute('aria-keyshortcuts')).toMatch(
      /^Alt\+ArrowUp Alt\+ArrowDown F2 (Meta|Control)\+Shift\+P$/,
    );
  });

  it('a right-click gives the row’s menu at the pointer, and no system menu', () => {
    const run = actions();
    renderList(container, folder(['a.md'], { sort: 'order' }), null, run);
    const click = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 30 });
    Object.defineProperty(click, 'clientY', { value: 40 });
    row('a.md').dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
    expect(run.menu).toHaveBeenCalledWith('a.md', { x: 30, y: 40 }, true);
  });

  it('offers its sorts in a menu, the one in use checked, and sorts by the one chosen', () => {
    const run = actions();
    renderList(container, folder(['a.md']), null, run);
    const sort = container.querySelector<HTMLButtonElement>('.list__sort');
    expect(sort?.querySelector('svg.icon')).not.toBeNull(); // controls are icons
    expect(sort?.dataset.tip).toBe('Sort');
    expect(sort?.getAttribute('aria-label')).toBe('Sorted by newest');
    sort?.click();
    const choices = [...document.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]')];
    expect(
      choices.map((choice) => [choice.textContent, choice.getAttribute('aria-checked')]),
    ).toEqual([
      ['Order', 'false'],
      ['Title', 'false'],
      ['Newest', 'true'],
    ]);
    choices[1]?.click();
    expect(run.sort).toHaveBeenCalledWith('title');
  });

  describe('thousands of notes', () => {
    const many = (first = 'n0.md') =>
      folder([first, ...Array.from({ length: 2999 }, (_, i) => `n${i + 1}.md`)]);
    /** The list drawn once, then made a scroller 400 px tall: happy-dom lays nothing out. */
    const long = (list: NoteList) => {
      renderList(container, list, null, actions());
      const rows = container.querySelector<HTMLElement>('ul.rows') as HTMLElement;
      rows.style.overflowY = 'auto';
      Object.defineProperty(rows, 'clientHeight', { value: 400, configurable: true });
      renderList(container, list, null, actions());
      return rows;
    };

    it('draws the rows in sight, each saying where it stands among them all', () => {
      long(many());
      const drawn = container.querySelectorAll('ul.rows > li[aria-posinset]');
      expect(drawn.length).toBeGreaterThan(0);
      expect(drawn.length).toBeLessThan(100);
      expect(drawn[0]?.getAttribute('aria-setsize')).toBe('3000');
    });

    it('keeps its list, and each row’s element, from one draw to the next', () => {
      const rows = long(many());
      const first = row('n0.md');
      renderList(container, many(), null, actions());
      expect(container.querySelector('ul.rows')).toBe(rows);
      expect(row('n0.md')).toBe(first);
    });

    // Fails today (docs/backlog.md, #35): `windowed.set` hands the keyboard to the list before
    // renderList reads which row had it, and putting the list back drops it to the body.
    // When this passes, drop `.fails`.
    it.fails('keeps the keyboard on the note a redraw moved out of sight', () => {
      long(many());
      row('n0.md').focus();
      const moved = folder([...Array.from({ length: 2999 }, (_, i) => `n${i + 1}.md`), 'n0.md']);
      renderList(container, moved, null, actions());
      expect((document.activeElement as HTMLElement).dataset.path).toBe('n0.md');
      expect(document.activeElement?.closest('li')?.getAttribute('aria-posinset')).toBe('3000');
    });
  });

  describe('a redraw', () => {
    it('gives the keyboard back to the row that had it, wherever that row went', () => {
      renderList(container, folder(['a.md', 'b.md', 'c.md']), null, actions());
      row('b.md').focus();
      renderList(container, folder(['c.md', 'a.md', 'b.md']), null, actions());
      expect(document.activeElement).toBe(row('b.md'));
    });

    it('gives it to the row now in its place when that note is gone, or the last row', () => {
      renderList(container, folder(['a.md', 'b.md', 'c.md']), null, actions());
      row('b.md').focus();
      renderList(container, folder(['a.md', 'c.md']), null, actions());
      expect(document.activeElement).toBe(row('c.md'));

      row('c.md').focus();
      renderList(container, folder(['a.md']), null, actions());
      expect(document.activeElement).toBe(row('a.md'));
    });

    it('takes nothing when the keyboard was elsewhere', () => {
      const field = document.createElement('input');
      document.body.append(field);
      renderList(container, folder(['a.md']), null, actions());
      field.focus();
      renderList(container, folder(['a.md', 'b.md']), null, actions());
      expect(document.activeElement).toBe(field);
    });
  });
});
