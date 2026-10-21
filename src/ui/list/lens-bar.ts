// The lens laid over a list (docs/design/explorations/order.md): a sort and
// the tag filter, each a control in the list's head, and each part of the
// lens that's on, a chip with its ×. Your order stays underneath: clearing
// the lens brings it back. Drawn in the note list's head and, with two
// panes, for the chosen row in the sidebar.

import { filtering, type TagFilter, withTagState } from '../../core/tags';
import { h } from '../dom';
import { icon } from '../icons';
import { openMenu } from '../menu/menu';
import type { NoteList, NoteSort } from '../vault/vault-state';
import { type FilterTag, openTagFilter } from './tag-filter-panel';

export const SORT_NAMES: Record<NoteSort, string> = {
  order: 'Order',
  title: 'Title',
  modified: 'Newest',
};

export interface LensActions {
  sort(sort: NoteSort): void;
  filter(next: TagFilter): void;
  /** The vault's tags, for the filter, each with how many notes carry it. */
  tags(): readonly FilterTag[];
}

/** The sort a list has when none is chosen: its own order where it has one. */
export const ownSort = (list: NoteList): NoteSort =>
  list.sorts.includes('order') ? 'order' : 'modified';

const iconButton = (
  name: 'sort' | 'filter',
  label: string,
  tip: string,
  run: (button: HTMLButtonElement) => void,
  extra: Record<string, string | undefined> = {},
) => {
  const button: HTMLButtonElement = h(
    'button',
    {
      class: `icon-button list__${name}`,
      attrs: { type: 'button', 'aria-label': label, 'data-tip': tip, ...extra },
      on: { click: () => run(button) },
    },
    icon(name),
  );
  return button;
};

const chip = (words: string, clear: string, run: () => void, out = false) =>
  h(
    'span',
    { class: out ? 'chip is-out' : 'chip', attrs: { title: out ? 'Kept out' : undefined } },
    h('span', { class: 'chip__words', text: words }),
    h(
      'button',
      {
        class: 'icon-button chip__clear',
        attrs: { type: 'button', 'aria-label': clear },
        on: { click: run },
      },
      icon('close'),
    ),
  );

export interface LensParts {
  /** The sort and the filter, for the head. */
  readonly controls: readonly HTMLElement[];
  /** The lens's chips, under the head; null with no lens on. */
  readonly chips: HTMLElement | null;
}

/**
 * The lens's controls and chips for `list`; none for a search, which has no lens.
 * `where` names the pane it's drawn in, for the controls' lasting keys.
 */
export function lensParts(list: NoteList, actions: LensActions, where = 'list'): LensParts {
  if (list.kind === 'search' || list.sorts.length === 0 || !list.sort) {
    return { controls: [], chips: null };
  }
  const sort = list.sort;
  const filter = list.filter;
  const own = ownSort(list);
  const sortButton = iconButton(
    'sort',
    `Sorted by ${SORT_NAMES[sort].toLowerCase()}`,
    'Sort',
    (opener) =>
      openMenu(
        list.sorts.map((choice) => ({
          label: SORT_NAMES[choice],
          checked: choice === sort,
          run: () => actions.sort(choice),
        })),
        { opener },
        'Sort',
      ),
    { 'aria-haspopup': 'menu', 'data-key': `lens-sort:${where}` },
  );
  sortButton.classList.toggle('is-on', sort !== own);
  const filterButton = iconButton(
    'filter',
    'Filter by tag',
    'Filter by tag',
    (opener) => openTagFilter(opener, filter, actions),
    { 'aria-haspopup': 'dialog', 'aria-expanded': 'false', 'data-key': `lens-filter:${where}` },
  );
  filterButton.classList.toggle('is-on', filter !== undefined && filtering(filter));

  const parts: HTMLElement[] = [];
  if (sort !== own) {
    parts.push(
      chip(SORT_NAMES[sort], `Back to ${SORT_NAMES[own].toLowerCase()}`, () => actions.sort(own)),
    );
  }
  if (filter && filtering(filter)) {
    const name = (key: string) => actions.tags().find((tag) => tag.key === key)?.tag ?? key;
    for (const [key, state] of filter.tags) {
      parts.push(
        chip(
          `#${name(key)}`,
          `Leave #${name(key)} alone`,
          () => actions.filter(withTagState(filter, key, undefined)),
          state === 'out',
        ),
      );
    }
    if (filter.tags.filter(([, state]) => state === 'in').length > 1) {
      parts.push(
        h('span', {
          class: 'label list__match',
          text: filter.match === 'all' ? 'all of' : 'any of',
        }),
      );
    }
  }
  return {
    controls: [filterButton, sortButton],
    chips: parts.length > 0 ? h('div', { class: 'list__lens' }, ...parts) : null,
  };
}

/** Under a folder's head while a lens is on: why its rows don't drag. */
export const lensLine = (list: NoteList): HTMLElement | null =>
  list.folder !== undefined &&
  list.sorts.includes('order') &&
  (list.sort !== 'order' || (list.filter !== undefined && filtering(list.filter)))
    ? h('p', {
        class: 'list__locked',
        text: 'Sorted or filtered: your order is kept underneath. Clear it to drag.',
      })
    : null;
