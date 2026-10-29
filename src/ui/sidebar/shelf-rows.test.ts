import { describe, expect, it, vi } from 'vitest';
import { buildTree, type VaultEntry } from '../../core/vault';
import { shelfRows } from './shelf-rows';

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
) {
  const actions = {
    openEpub: vi.fn(),
    chapter: vi.fn(),
    bookMenu: vi.fn(),
    renameBook: vi.fn(),
    trashBook: vi.fn(),
  };
  const list = document.createElement('ul');
  list.append(...shelfRows({ tree: TREE, current, contents }, actions));
  return { list, actions };
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

  it('makes a book a control and a folder a label: nothing to drag or drop onto', () => {
    const { list, actions } = draw();
    expect(list.querySelectorAll('.tree-row--shelf-folder button')).toHaveLength(0);
    expect(list.querySelectorAll('[data-path], [data-folder]')).toHaveLength(0);
    const book = list.querySelector<HTMLButtonElement>('[data-key="epub:Fic/Research/Style.epub"]');
    book?.click();
    expect(actions.openEpub).toHaveBeenCalledWith('Fic/Research/Style.epub');
  });

  it('marks the book on the page, and lists its contents under it with two panes', () => {
    const { list, actions } = draw('Loose.epub', {
      path: 'Loose.epub',
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

  it('marks once a chapter whose file a part starts in too, each row its own key', () => {
    const { list } = draw('Loose.epub', {
      path: 'Loose.epub',
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
    const { actions } = draw();
    const tree = buildTree([entry('a.md', 'note')], 'Vault');
    expect(shelfRows({ tree, current: null, contents: null }, actions)).toEqual([]);
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
    const contents = { path: 'Loose.epub', rows: [{ title: 'One', depth: 0, spine: 0 }], spine: 0 };
    const { list, actions } = draw('Loose.epub', contents);
    const chapter = list.querySelector('.tree-row--chapter .tree-row__name') as HTMLElement;
    chapter.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
    chapter.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'F2' }));
    expect(actions.bookMenu).not.toHaveBeenCalled();
    expect(actions.renameBook).not.toHaveBeenCalled();
  });
});
