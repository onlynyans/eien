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
    goFound: vi.fn(),
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

  it('turns a folder’s twisty as it opens and shuts, from the row’s own state (#56)', () => {
    const { list } = draw(null, null, ['Fic']);
    const twist = (path: string) =>
      list.querySelector(`[data-key="twist:/shelf/${path}"]`) as HTMLElement;
    // What ./tree.css turns it by, as no aria-expanded is there to.
    expect(twist('Cooking').dataset.open).toBe('true');
    expect(twist('Fic').dataset.open).toBe('false');
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
      found: null,
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
      found: null,
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
      found: null,
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
      found: null,
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
      found: null,
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
    found: null,
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
    expect(list.querySelectorAll('.tree-lenses .book-lens')[1]?.textContent).toBe('Marks 2');
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

// #40, Phase 5c: with two panes, what the field finds stands under the book's row.
describe('a book’s Found on SHELF', () => {
  it('lists each match from its words, the match marked, its page its count; a click goes there', () => {
    const match = {
      spine: 1,
      from: 40,
      to: 46,
      before: 'a long run of words before it, said his lady to Mr. ',
      words: 'Bennet',
      after: ' one day',
      page: '3',
      chapter: 'Chapter I',
    };
    const { list, actions } = draw('Loose.epub', {
      path: 'Loose.epub',
      lens: 'found',
      marks: [],
      found: {
        rows: [match],
        words: 'Bennet',
        title: 'Loose',
        searched: 1,
        chapters: 1,
        done: true,
        more: false,
      },
      rows: [{ title: 'Chapter I', depth: 0, spine: 1 }],
      spine: 1,
    });
    const row = list.querySelector<HTMLButtonElement>('.tree-row--found .tree-row__name');
    // One line, so it begins at the match: never cut off before it.
    expect(row?.querySelector('.tree-row__label')?.textContent).toBe('Bennet one day');
    expect(row?.querySelector('.found-row__match')?.textContent).toBe('Bennet');
    expect(row?.querySelector('.count')?.textContent).toBe('3');
    expect(row?.title).toBe(`Chapter I: ${match.before}Bennet one day`);
    row?.click();
    expect(actions.goFound).toHaveBeenCalledWith('Loose.epub', match);
    const tabs = [...list.querySelectorAll<HTMLButtonElement>('.tree-lenses .book-lens')];
    expect(tabs.map((tab) => tab.textContent)).toEqual(['Contents 1', 'Marks 0', 'Found 1']);
  });
});

describe('a book’s Found on SHELF, with two panes (#40, Phase 5c, as QA tried it)', () => {
  const BOOK = 'Loose.epub';
  const match = (from: number, page: string | null) => ({
    spine: 1,
    from,
    to: from + 6,
    before: '…said to Mr. ',
    words: 'Bennet',
    after: ' one day',
    page,
    chapter: 'Chapter I',
  });
  const found = (over = {}) => ({
    rows: [match(10, '3'), match(90, null)],
    words: 'Bennet',
    title: 'Pride and Prejudice',
    searched: 3,
    chapters: 3,
    done: true,
    more: false,
    ...over,
  });
  const contentsOf = (over: Partial<NonNullable<Parameters<typeof draw>[1]>> = {}) => ({
    path: BOOK,
    lens: 'found' as BookLens,
    marks: [] as MarkRow[],
    found: found(),
    rows: [{ title: 'Chapter I', depth: 0, spine: 1 }],
    spine: 1,
    ...over,
  });

  it('lists each match under the book in its words with its page, its chapter its tooltip; a click goes there', () => {
    const { list, actions } = draw(BOOK, contentsOf());
    const names = [...list.querySelectorAll<HTMLButtonElement>('.tree-row--found .tree-row__name')];
    // One line, so each begins at its match (the review, Phase 5c); the words before in its tooltip.
    expect(names.map((name) => name.textContent)).toEqual(['Bennet one day 3', 'Bennet one day']);
    expect(names[0]?.title).toBe('Chapter I: …said to Mr. Bennet one day');
    expect(new Set(names.map((name) => name.dataset.key)).size).toBe(2);
    expect(texts(list, '.tree-row--chapter')).toEqual([]);
    const tabs = [...list.querySelectorAll<HTMLButtonElement>('.tree-lenses .book-lens')];
    expect(tabs.map((tab) => tab.textContent)).toEqual(['Contents 1', 'Marks 0', 'Found 2']);
    expect(tabs[2]?.getAttribute('aria-pressed')).toBe('true');
    names[1]?.click();
    expect(actions.goFound).toHaveBeenCalledExactlyOnceWith(BOOK, match(90, null));
  });

  it('says under its rows that it’s still searching, or that there are none, as the tree’s hint', () => {
    const searching = draw(BOOK, contentsOf({ found: found({ done: false, searched: 1 }) })).list;
    expect(texts(searching, '.tree-hint')).toEqual(['Searching… chapter 2 of 3']);
    const none = draw(BOOK, contentsOf({ found: found({ rows: [] }) })).list;
    expect(texts(none, '.tree-row--found')).toEqual([]);
    expect(texts(none, '.tree-hint')).toEqual(['No “Bennet” in Pride and Prejudice.']);
  });

  it('shows the chapters again once nothing is searched, Found there only while a search is on (#61)', () => {
    const { list } = draw(BOOK, contentsOf({ found: null }));
    expect(texts(list, '.tree-row--chapter')).toEqual(['Chapter I']);
    const tabs = (drawn: HTMLElement) =>
      [...drawn.querySelectorAll<HTMLButtonElement>('.tree-lenses .book-lens')].map(
        (tab) => tab.textContent,
      );
    expect(tabs(list)).toEqual(['Contents 1', 'Marks 0']);
    // None found: Found 0, still the lens pressed over its line.
    const none = draw(BOOK, contentsOf({ found: found({ rows: [] }) })).list;
    expect(tabs(none)).toEqual(['Contents 1', 'Marks 0', 'Found 0']);
    expect(none.querySelector('.tree-lenses [aria-pressed="true"]')?.textContent).toBe('Found 0');
    expect(tabs(draw(BOOK, contentsOf()).list)).toEqual(['Contents 1', 'Marks 0', 'Found 2']);
  });

  it('with Marks on the edge, puts Found’s rows in the chapters’ place while there are words', () => {
    const searched = draw(BOOK, contentsOf({ marks: null, lens: 'contents' })).list;
    expect(searched.querySelector('.tree-lenses')).toBeNull();
    expect(texts(searched, '.tree-row--found')).toHaveLength(2);
    expect(texts(searched, '.tree-row--chapter')).toEqual([]);
    const cleared = draw(BOOK, contentsOf({ marks: null, lens: 'contents', found: null })).list;
    expect(texts(cleared, '.tree-row--chapter')).toEqual(['Chapter I']);
  });
});
