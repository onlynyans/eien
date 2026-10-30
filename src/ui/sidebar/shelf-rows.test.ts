import { describe, expect, it, vi } from 'vitest';
import { buildTree, type VaultEntry } from '../../core/vault';
import { folderRowEvents } from './row-keys';
import { type ShelfFolders, shelfRows } from './shelf-rows';

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
    const row = { mark, spine: 1, page: '3', chapter: 'Chapter I' };
    const { list, actions } = draw('Loose.epub', {
      path: 'Loose.epub',
      lens: 'marks',
      marks: [row],
      rows: [{ title: 'Chapter I', depth: 0, spine: 1 }],
      spine: 1,
    });
    const tabs = [...list.querySelectorAll<HTMLButtonElement>('.tree-row--lenses [role="tab"]')];
    expect(tabs.map((tab) => tab.getAttribute('aria-selected'))).toEqual(['false', 'true']);
    expect(texts(list, '.tree-row--chapter')).toEqual([]);
    const name = list.querySelector<HTMLButtonElement>('.tree-row--mark .tree-row__name');
    expect(name?.textContent).toBe('It is a truth3');
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
    expect(texts(list, '.tree-row--empty')).toEqual(['Nothing kept yet. B bookmarks a page.']);
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
