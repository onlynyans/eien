// The lens over a list, as the window draws it: the sort and filter in the
// list's head, a chip for each part that's on, the line saying why rows
// don't drag, and the tag filter's panel with its three states.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { NO_FILTER, type TagFilter } from '../../core/tags';
import { closeMenu } from '../menu/menu';
import type { NoteList } from '../vault/vault-state';
import { lensLine, lensParts, ownSort } from './lens-bar';
import { listLabel } from './list';
import { type FilterTag, filterTags, openTagFilter } from './tag-filter-panel';

const TAGS: FilterTag[] = [
  { tag: 'draft', key: 'draft', count: 3, depth: 0 },
  { tag: 'fic', key: 'fic', count: 5, depth: 0 },
  { tag: 'fic/aot', key: 'fic/aot', count: 2, depth: 1 },
];

const list = (extra: Partial<NoteList> = {}): NoteList => ({
  kind: 'folder',
  heading: 'Drafts',
  notes: [],
  total: 4,
  sort: 'order',
  sorts: ['order', 'title', 'modified'],
  folder: 'Drafts',
  ...extra,
});

const actions = () => ({ sort: vi.fn(), filter: vi.fn(), tags: () => TAGS });

afterEach(() => {
  closeMenu();
  document.querySelector('.tag-filter')?.remove();
  document.body.replaceChildren();
});

describe('lensParts', () => {
  it('a list in its own order, unfiltered: the two controls, no chips', () => {
    const parts = lensParts(list(), actions());
    expect(parts.controls.map((control) => control.getAttribute('aria-label'))).toEqual([
      'Filter by tag',
      'Sorted by order',
    ]);
    expect(parts.chips).toBeNull();
    expect(parts.controls.some((control) => control.classList.contains('is-on'))).toBe(false);
  });

  it('a search has no lens', () => {
    const search: NoteList = { kind: 'search', heading: 'x', notes: [], total: 0, sorts: [] };
    expect(lensParts(search, actions())).toEqual({ controls: [], chips: null });
  });

  it('a sort other than its own is a chip, whose × goes back to its own order', () => {
    const run = actions();
    const parts = lensParts(list({ sort: 'title' }), run);
    const chip = parts.chips?.querySelector('.chip');
    expect(chip?.textContent).toBe('Title');
    chip?.querySelector('button')?.click();
    expect(run.sort).toHaveBeenCalledWith('order');
    expect(parts.controls[1]?.classList.contains('is-on')).toBe(true);
  });

  it('a list with no order of its own (All Notes) is at home sorted newest', () => {
    const all = list({
      kind: 'all',
      folder: undefined,
      sort: 'modified',
      sorts: ['title', 'modified'],
    });
    expect(ownSort(all)).toBe('modified');
    expect(lensParts(all, actions()).chips).toBeNull();
  });

  it('each tag in the filter is a chip, a kept-out one struck; × leaves it alone; “all of” with two wanted', () => {
    const run = actions();
    const filter: TagFilter = {
      tags: [
        ['fic', 'in'],
        ['draft', 'out'],
        ['fic/aot', 'in'],
      ],
      match: 'all',
    };
    const parts = lensParts(list({ filter }), run);
    const chips = [...(parts.chips?.querySelectorAll('.chip') ?? [])];
    expect(chips.map((chip) => chip.textContent)).toEqual(['#fic', '#draft', '#fic/aot']);
    expect(chips[1]?.classList.contains('is-out')).toBe(true);
    expect(parts.chips?.querySelector('.list__match')?.textContent).toBe('all of');
    chips[1]?.querySelector('button')?.click();
    expect(run.filter).toHaveBeenCalledWith({
      tags: [
        ['fic', 'in'],
        ['fic/aot', 'in'],
      ],
      match: 'all',
    });
  });
});

describe('lensLine', () => {
  it('says why a folder’s rows don’t drag while it’s sorted or filtered', () => {
    expect(lensLine(list())).toBeNull();
    expect(lensLine(list({ sort: 'title' }))?.textContent).toMatch(/your order is kept underneath/);
    expect(lensLine(list({ filter: { tags: [['a', 'in']], match: 'all' } }))).not.toBeNull();
    expect(lensLine(list({ kind: 'tag', folder: undefined, sort: 'title' }))).toBeNull();
  });
});

describe('listLabel', () => {
  it('a filtered list says how many of how many', () => {
    expect(
      listLabel(list({ total: 2, of: 12, filter: { tags: [['a', 'in']], match: 'all' } })),
    ).toBe('2 of 12 notes');
  });
});

describe('the tag filter’s panel', () => {
  const open = (filter: TagFilter = NO_FILTER) => {
    const opener = document.body.appendChild(document.createElement('button'));
    opener.dataset.key = 'lens-filter:list';
    const run = { filter: vi.fn(), tags: () => TAGS };
    openTagFilter(opener, filter, run);
    const tri = (key: string) =>
      document.querySelector<HTMLButtonElement>(`.tri[data-tri="${key}"]`) as HTMLButtonElement;
    return { run, tri, opener };
  };

  it('lists the vault’s tags, nested, each left alone to start', () => {
    const { tri } = open();
    expect(tri('fic/aot').style.getPropertyValue('--depth')).toBe('1');
    expect(tri('draft').getAttribute('aria-label')).toBe('#draft: left alone');
    expect(document.activeElement).toBe(tri('draft'));
  });

  it('a press: wanted, then kept out, then left alone; each change sent at once', () => {
    const { run, tri } = open();
    tri('draft').click();
    expect(run.filter).toHaveBeenLastCalledWith({ tags: [['draft', 'in']], match: 'all' });
    expect(tri('draft').dataset.state).toBe('in');
    tri('draft').click();
    expect(tri('draft').dataset.state).toBe('out');
    expect(tri('draft').getAttribute('aria-label')).toBe('#draft: kept out');
    tri('draft').click();
    expect(run.filter).toHaveBeenLastCalledWith({ tags: [], match: 'all' });
  });

  it('⌥ with a press keeps a tag out at once', () => {
    const { run, tri } = open();
    tri('fic').dispatchEvent(new MouseEvent('click', { bubbles: true, altKey: true }));
    expect(run.filter).toHaveBeenLastCalledWith({ tags: [['fic', 'out']], match: 'all' });
  });

  it('All of or Any of; Every note clears them all', () => {
    const { run } = open({ tags: [['draft', 'in']], match: 'all' });
    document.querySelector<HTMLButtonElement>('[data-match="any"]')?.click();
    expect(run.filter).toHaveBeenLastCalledWith({ tags: [['draft', 'in']], match: 'any' });
    document.querySelector<HTMLButtonElement>('[data-key="every-note"]')?.click();
    expect(run.filter).toHaveBeenLastCalledWith({ tags: [], match: 'any' });
    expect(document.querySelector('[data-key="every-note"]')).toBeNull();
  });

  it('the arrows move through it, and Esc closes it', () => {
    const { tri, opener } = open();
    const panel = document.querySelector('.tag-filter') as HTMLElement;
    panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(document.activeElement).toBe(tri('fic'));
    panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(document.querySelector('.tag-filter')).toBeNull();
    expect(opener.getAttribute('aria-expanded')).toBe('false');
  });

  it('flattens the tag tree, each tag after the one it’s nested in', () => {
    const node = (tag: string, children = [] as never[]) => ({
      name: tag.split('/').at(-1) ?? tag,
      tag,
      key: tag,
      count: 1,
      children,
    });
    expect(
      filterTags([node('fic', [node('fic/aot')] as never[]), node('draft')]).map((tag) => [
        tag.tag,
        tag.depth,
      ]),
    ).toEqual([
      ['fic', 0],
      ['fic/aot', 1],
      ['draft', 0],
    ]);
  });
});
