import { describe, expect, it, vi } from 'vitest';
import { buildTree, type VaultEntry } from '../../core/vault';
import type { BookLens, MarkRow } from '../list/book-lenses';
import { folderRowEvents } from './row-keys';
import { type ShelfFolders, shelfRows } from './shelf-rows';
import { SidebarFocus } from './sidebar-focus';
import type { TreeWindows } from './tree-windows';

const entry = (path: string, kind: VaultEntry['kind']): VaultEntry => ({
  path,
  kind,
  modified: 0,
  size: 0,
});
const TREE = buildTree(
  [
    entry('Cooking/Soup.md', 'note'),
    entry('Cooking/Boston.epub', 'epub'),
    entry('Fic/Draft.md', 'note'),
    entry('Fic/Research/Style.epub', 'epub'),
    entry('Ideas/Idea.md', 'note'),
    entry('Loose.epub', 'epub'),
  ],
  'Vault',
);

function draw(
  current: string | null = null,
  contents: Parameters<typeof shelfRows>[0]['contents'] = null,
  shut: string[] = [],
  editing: string | null = null,
) {
  const folder = { menu: vi.fn(), rename: vi.fn(), move: vi.fn() };
  const folders = {
    events: (path: string) =>
      folderRowEvents({
        menu: (at) => folder.menu(path, at),
        rename: () => folder.rename(path),
        move: (how) => folder.move(path, how),
      }),
    fold: vi.fn(),
    edit: (node, depth) =>
      node.path === editing
        ? Object.assign(document.createElement('li'), { className: 'field', title: `${depth}` })
        : null,
  } satisfies ShelfFolders;
  const actions = {
    openEpub: vi.fn(),
    openBookBeside: vi.fn(),
    chapter: vi.fn(),
    bookMenu: vi.fn(),
    renameBook: vi.fn(),
    trashBook: vi.fn(),
    lens: vi.fn(),
    goMark: vi.fn(),
    unmark: vi.fn(),
  };
  const list = document.createElement('ul');
  list.append(...shelfRows({ tree: TREE, current, contents, shut }, actions, folders));
  return { list, actions, folder, folders };
}

const texts = (list: HTMLElement, selector: string) =>
  [...list.querySelectorAll(selector)].map((each) => each.textContent);

describe('SHELF’s rows', () => {
  it('lists every book under the folders on the way to it, at their depth; no folder without one', () => {
    const { list } = draw();
    expect(texts(list, '.tree-row--shelf-folder')).toEqual(['Cooking', 'Fic', 'Research']);
    expect(texts(list, '.tree-row--epub')).toEqual(['Boston', 'Style', 'Loose']);
    const depth = (text: string) =>
      [...list.querySelectorAll<HTMLElement>('.tree-row')]
        .find((row) => row.textContent === text)
        ?.style.getPropertyValue('--depth');
    expect([depth('Fic'), depth('Research'), depth('Style'), depth('Loose')]).toEqual([
      '0',
      '1',
      '2',
      '0',
    ]);
  });

  it('opens a book on a click; a book is never dragged, and nothing drops on it', () => {
    const { list, actions } = draw();
    expect(
      list.querySelectorAll('.tree-row--epub [data-path], .tree-row--epub [data-folder]'),
    ).toHaveLength(0);
    const book = list.querySelector<HTMLButtonElement>('[data-key="epub:Fic/Research/Style.epub"]');
    book?.click();
    expect(actions.openEpub).toHaveBeenCalledWith('Fic/Research/Style.epub');
  });

  it('makes a folder FOLDERS’ own row: a twisty, a name to drop on, its keys told, open at first', () => {
    const { list } = draw();
    const name = list.querySelector('[data-key="shelf:Fic/Research"]') as HTMLElement;
    expect(name.tagName).toBe('BUTTON');
    expect(name.dataset.folder).toBe('Fic/Research');
    expect(name.getAttribute('aria-expanded')).toBe('true');
    expect(name.getAttribute('aria-keyshortcuts')).toBe(
      'F2 Alt+ArrowUp Alt+ArrowDown Alt+ArrowLeft Alt+ArrowRight',
    );
    // Its twisty is the pointer's alone: the name is the one control the keyboard and assistive tech meet.
    const twist = list.querySelector('[data-key="twist:/shelf/Fic/Research"]') as HTMLElement;
    expect(twist.getAttribute('aria-hidden')).toBe('true');
    expect(twist.getAttribute('tabindex')).toBe('-1');
    expect(twist.hasAttribute('aria-expanded')).toBe(false);
  });

  it('shuts and opens a folder by its twisty or a click on its name, and draws a shut one’s rows not at all', () => {
    const { list, folders } = draw(null, null, ['Fic']);
    expect(texts(list, '.tree-row--shelf-folder')).toEqual(['Cooking', 'Fic']);
    expect(texts(list, '.tree-row--epub')).toEqual(['Boston', 'Loose']);
    const fic = list.querySelector('[data-key="shelf:Fic"]') as HTMLElement;
    expect(fic.getAttribute('aria-expanded')).toBe('false');
    fic.click();
    (list.querySelector('[data-key="twist:/shelf/Cooking"]') as HTMLElement).click();
    expect(folders.fold.mock.calls).toEqual([['Fic'], ['Cooking']]);
  });

  it('gives a folder its menu, F2 and ⌥ and an arrow, the sidebar’s own', () => {
    const { list, folder } = draw();
    const fic = list.querySelector('[data-key="shelf:Fic"]') as HTMLElement;
    fic.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 4, clientY: 5 }));
    expect(folder.menu).toHaveBeenLastCalledWith('Fic', { x: 4, y: 5 });
    fic.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'F2' }));
    expect(folder.rename).toHaveBeenLastCalledWith('Fic');
    fic.dispatchEvent(
      new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowDown', altKey: true }),
    );
    expect(folder.move).toHaveBeenLastCalledWith('Fic', 'down');
  });

  it('draws a folder being renamed here as its field, at its depth', () => {
    const { list } = draw(null, null, [], 'Fic/Research');
    expect(list.querySelector('[data-key="shelf:Fic/Research"]')).toBeNull();
    expect((list.querySelector('.field') as HTMLElement).title).toBe('1');
  });

  it('marks the book on the page, and lists its contents under it with two panes', () => {
    const { list, actions } = draw('Loose.epub', {
      path: 'Loose.epub',
      lens: 'contents',
      marks: null,
      rows: [
        { title: 'Part One', depth: 0, spine: 1 },
        { title: 'Chapter 1', depth: 1, spine: 2 },
      ],
      spine: 2,
    });
    expect(texts(list, '[aria-current="true"]')).toEqual(['Loose', 'Chapter 1']);
    expect(list.querySelector('[data-key="epub:Loose.epub"]')?.getAttribute('aria-current')).toBe(
      'true',
    );
    expect(texts(list, '.tree-row--chapter')).toEqual(['Part One', 'Chapter 1']);
    list.querySelector<HTMLButtonElement>('[data-key="Loose.epub:chapter:1:Part One"]')?.click();
    expect(actions.chapter).toHaveBeenCalledWith('Loose.epub', 1);
  });

  it('lists the book’s lenses first under it, and under Marks its bookmarks (Phase 4c)', () => {
    const mark = { chapter: 'c1.xhtml', offset: 5, words: 'It is a truth' };
    const row = {
      kind: 'bookmark' as const,
      offset: 5,
      mark,
      spine: 1,
      page: '3',
      chapter: 'Chapter I',
    };
    const { list, actions } = draw('Loose.epub', {
      path: 'Loose.epub',
      lens: 'marks',
      marks: [row],
      rows: [{ title: 'Chapter I', depth: 0, spine: 1 }],
      spine: 1,
    });
    const tabs = [...list.querySelectorAll<HTMLButtonElement>('.tree-lenses .book-lens')];
    expect(tabs.map((tab) => tab.getAttribute('aria-pressed'))).toEqual(['false', 'true']);
    expect(texts(list, '.tree-row--chapter')).toEqual([]);
    const name = list.querySelector<HTMLButtonElement>('.tree-row--mark .tree-row__name');
    expect(name?.textContent).toBe('It is a truth 3');
    name?.click();
    expect(actions.goMark).toHaveBeenCalledWith('Loose.epub', row);
    name?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }));
    expect(actions.unmark).toHaveBeenCalledWith('Loose.epub', row);
    tabs[0]?.click();
    expect(actions.lens).toHaveBeenCalledWith('Loose.epub', 'contents');
  });

  it('says under Marks that none is kept', () => {
    const { list } = draw('Loose.epub', {
      path: 'Loose.epub',
      lens: 'marks',
      marks: [],
      rows: [],
      spine: 1,
    });
    expect(texts(list, '.tree-hint')).toEqual([
      'Nothing kept yet. B bookmarks a page; H keeps the words you choose.',
    ]);
    // Not a row: it neither lights nor presses as one.
    expect(list.querySelectorAll('.tree-row--empty')).toHaveLength(0);
  });

  it('marks once a chapter whose file a part starts in too, each row its own key', () => {
    const { list } = draw('Loose.epub', {
      path: 'Loose.epub',
      lens: 'contents',
      marks: null,
      rows: [
        { title: 'Part One', depth: 0, spine: 1 },
        { title: 'Chapter 1', depth: 1, spine: 1 },
      ],
      spine: 1,
    });
    expect(texts(list, '.tree-row--chapter [aria-current="true"]')).toEqual(['Part One']);
    const keys = [...list.querySelectorAll<HTMLElement>('.tree-row--chapter [data-key]')].map(
      (row) => row.dataset.key,
    );
    expect(new Set(keys).size).toBe(2);
  });

  it('draws nothing for a vault with no book', () => {
    const { actions, folders } = draw();
    const tree = buildTree([entry('a.md', 'note')], 'Vault');
    expect(shelfRows({ tree, current: null, contents: null, shut: [] }, actions, folders)).toEqual(
      [],
    );
  });

  it('gives a book’s row its menu by right-click, the menu key or Shift+F10, as a note’s', () => {
    const { list, actions } = draw();
    const book = list.querySelector<HTMLButtonElement>('[data-epub="Loose.epub"]') as HTMLElement;
    book.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 40, clientY: 50 }));
    expect(actions.bookMenu).toHaveBeenLastCalledWith('Loose.epub', { x: 40, y: 50 });
    for (const init of [{ key: 'ContextMenu' }, { key: 'F10', shiftKey: true }]) {
      book.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, ...init }));
    }
    expect(actions.bookMenu).toHaveBeenCalledTimes(3);
    expect(actions.openEpub).not.toHaveBeenCalled();
  });

  it('opens a book beside the page on Ctrl-click or Ctrl+Enter, as a note’s row does (#40, Phase 2c)', () => {
    const { list, actions } = draw();
    const book = list.querySelector<HTMLButtonElement>('[data-epub="Loose.epub"]') as HTMLElement;
    // The tests' platform isn't a Mac's: Ctrl, as ⌘ on a Mac.
    book.dispatchEvent(new MouseEvent('click', { bubbles: true, ctrlKey: true }));
    book.dispatchEvent(
      new KeyboardEvent('keydown', { bubbles: true, key: 'Enter', ctrlKey: true }),
    );
    expect(actions.openBookBeside).toHaveBeenCalledTimes(2);
    expect(actions.openBookBeside).toHaveBeenLastCalledWith('Loose.epub');
    expect(actions.openEpub).not.toHaveBeenCalled();
  });

  it('renames a book on F2 or a second click on its name, and trashes it on the trash’s key', () => {
    const { list, actions } = draw();
    const book = list.querySelector<HTMLButtonElement>('[data-epub="Loose.epub"]') as HTMLElement;
    expect(book.getAttribute('aria-keyshortcuts')).toBe('F2');
    book.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'F2' }));
    expect(actions.renameBook).toHaveBeenLastCalledWith('Loose.epub');
    const name = book.querySelector('.tree-row__label') as HTMLElement;
    name.click();
    name.click();
    expect(actions.openEpub).toHaveBeenCalledOnce();
    expect(actions.renameBook).toHaveBeenCalledTimes(2);
    // ⌘⌫ on a Mac, Ctrl+Delete elsewhere; the tests' platform isn't a Mac's.
    book.dispatchEvent(
      new KeyboardEvent('keydown', { bubbles: true, key: 'Delete', ctrlKey: true }),
    );
    expect(actions.trashBook).toHaveBeenCalledWith('Loose.epub');
  });

  it('gives a chapter under the book none of it: a chapter is chosen, never renamed or trashed', () => {
    const contents = {
      path: 'Loose.epub',
      rows: [{ title: 'One', depth: 0, spine: 0 }],
      spine: 0,
      lens: 'contents' as const,
      marks: null,
    };
    const { list, actions } = draw('Loose.epub', contents);
    const chapter = list.querySelector('.tree-row--chapter .tree-row__name') as HTMLElement;
    chapter.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
    chapter.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'F2' }));
    expect(actions.bookMenu).not.toHaveBeenCalled();
    expect(actions.renameBook).not.toHaveBeenCalled();
  });
});

describe('a book’s Marks on SHELF, as QA tried them (#40, Phase 4c)', () => {
  const BOOK = 'Cooking/Boston.epub';
  const markRowOf = (offset: number, page: string | null): MarkRow => ({
    kind: 'bookmark',
    offset,
    mark: { chapter: 'c1.xhtml', offset, words: `At ${offset}` },
    spine: 1,
    page,
    chapter: 'Chapter I',
  });
  const contentsOf = (marks: readonly MarkRow[] | null, lens: BookLens = 'marks') => ({
    path: BOOK,
    rows: [{ title: 'Chapter I', depth: 0, spine: 1 }],
    spine: 1,
    lens,
    marks,
  });
  const markNames = (list: HTMLElement) => [
    ...list.querySelectorAll<HTMLButtonElement>('.tree-row--mark .tree-row__name'),
  ];

  it('has no lenses with the marks on the page’s edge: its chapters alone, as before', () => {
    const { list } = draw(BOOK, contentsOf(null));
    expect(list.querySelectorAll('.tree-lenses, .book-lens')).toHaveLength(0);
    expect(texts(list, '.tree-row--chapter')).toEqual(['Chapter I']);
  });

  it('lays the lenses one step in from the book, a line of their own that the tree’s keys pass over', () => {
    const { list } = draw(BOOK, contentsOf([], 'contents'));
    const line = list.querySelector<HTMLElement>('.tree-lenses');
    // The book's row is at depth 1 (in Cooking): its rows at 2.
    expect(line?.style.getPropertyValue('--depth')).toBe('2');
    expect(line?.classList.contains('tree-row')).toBe(false);
    expect(line?.querySelector('.tree-row__name')).toBeNull();
    // It comes first, before the chapters.
    expect(line?.nextElementSibling?.classList.contains('tree-row--chapter')).toBe(true);
  });

  it('shows a bookmark’s page only once it’s known, and its chapter as its tooltip', () => {
    const { list } = draw(BOOK, contentsOf([markRowOf(0, '7'), markRowOf(50, null)]));
    const [known, unknown] = markNames(list);
    expect(known?.querySelector('.count')?.textContent).toBe('7');
    expect(unknown?.querySelector('.count')).toBeNull();
    expect(unknown?.textContent).toBe('At 50');
    expect(unknown?.title).toBe('Chapter I · bookmark');
    expect(unknown?.getAttribute('aria-keyshortcuts')).toBe('Delete Backspace');
  });

  it('takes one off once for a key held, and never for ⌘⌫ or Ctrl+Delete, which never trash the book either', () => {
    const row = markRowOf(0, '1');
    const { list, actions } = draw(BOOK, contentsOf([row]));
    const [name] = markNames(list);
    const key = (init: KeyboardEventInit) =>
      name?.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, ...init }));
    key({ key: 'Backspace', metaKey: true });
    key({ key: 'Delete', ctrlKey: true });
    key({ key: 'F2' });
    name?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
    expect(actions.unmark).not.toHaveBeenCalled();
    expect(actions.trashBook).not.toHaveBeenCalled();
    expect(actions.renameBook).not.toHaveBeenCalled();
    expect(actions.bookMenu).not.toHaveBeenCalled();
    key({ key: 'Delete' });
    key({ key: 'Delete', repeat: true });
    key({ key: 'Delete', repeat: true });
    expect(actions.unmark).toHaveBeenCalledExactlyOnceWith(BOOK, row);
  });

  it('hands the keyboard to the next bookmark when one is taken off, and with none left to the row after the book', () => {
    // The tree's keyboard across a redraw is the sidebar's (./sidebar-focus.ts): here over SHELF's rows.
    const body = document.body.appendChild(document.createElement('ul'));
    const noWindows = { focusKey: () => false } as unknown as TreeWindows;
    const focus = new SidebarFocus(body, noWindows, document.createElement('div'), () => false);
    const marks = [markRowOf(0, '1'), markRowOf(50, '2')];
    const drawWith = (shown: MarkRow[]) =>
      body.replaceChildren(...draw(BOOK, contentsOf(shown)).list.children);
    drawWith(marks);
    markNames(body)[0]?.focus();
    const giveBack = focus.hold();
    drawWith(marks.slice(1));
    giveBack();
    expect(document.activeElement).toBe(markNames(body)[0]);
    const again = focus.hold();
    drawWith([]);
    again();
    // The row now in its place: the next folder's (Fic), never lost to the window.
    expect((document.activeElement as HTMLElement).dataset.key).toBe('shelf:Fic');
    body.remove();
  });

  // QA (#40, Phase 5b): a highlight's row under the book, beside a bookmark's at its word.
  it('lists a highlight beside a bookmark at its word, each its own row, its kind its tooltip', () => {
    const bookmark = markRowOf(40, '3');
    const highlight: MarkRow = {
      kind: 'highlight',
      offset: 40,
      mark: { chapter: 'c1.xhtml', from: 40, to: 60, words: 'universally acknowledged' },
      spine: 1,
      page: '3',
      chapter: 'Chapter I',
    };
    const { list, actions } = draw(BOOK, contentsOf([bookmark, highlight]));
    const [first, second] = markNames(list);
    expect(second?.textContent).toBe('universally acknowledged 3');
    expect(second?.title).toBe('Chapter I · highlight');
    expect(first?.title).toBe('Chapter I · bookmark');
    expect(first?.dataset.key).not.toBe(second?.dataset.key);
    expect(list.querySelector('.tree-lenses .book-lens:last-child')?.textContent).toBe('Marks 2');
    second?.click();
    expect(actions.goMark).toHaveBeenCalledExactlyOnceWith(BOOK, highlight);
    second?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
    expect(actions.unmark).toHaveBeenCalledExactlyOnceWith(BOOK, highlight);
  });

  it('keeps the keyboard on the highlight’s row through a redraw, never the bookmark’s at its word', () => {
    const body = document.body.appendChild(document.createElement('ul'));
    const noWindows = { focusKey: () => false } as unknown as TreeWindows;
    const focus = new SidebarFocus(body, noWindows, document.createElement('div'), () => false);
    const highlight: MarkRow = {
      kind: 'highlight',
      offset: 40,
      mark: { chapter: 'c1.xhtml', from: 40, to: 60, words: 'Its words' },
      spine: 1,
      page: '3',
      chapter: 'Chapter I',
    };
    const drawWith = (shown: MarkRow[]) =>
      body.replaceChildren(...draw(BOOK, contentsOf(shown)).list.children);
    drawWith([markRowOf(40, '3'), highlight]);
    markNames(body)[1]?.focus();
    const giveBack = focus.hold();
    // A bookmark made before both: the highlight's row two down.
    drawWith([markRowOf(0, '1'), markRowOf(40, '3'), highlight]);
    giveBack();
    expect(document.activeElement).toBe(markNames(body)[2]);
    body.remove();
  });
});
