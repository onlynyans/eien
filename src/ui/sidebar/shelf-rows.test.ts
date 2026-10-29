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
  const actions = { openEpub: vi.fn(), chapter: vi.fn() };
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
    const actions = { openEpub: vi.fn(), chapter: vi.fn() };
    const tree = buildTree([entry('a.md', 'note')], 'Vault');
    expect(shelfRows({ tree, current: null, contents: null }, actions)).toEqual([]);
  });
});
