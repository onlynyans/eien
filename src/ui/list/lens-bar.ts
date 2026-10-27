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
  /** Start arranging the list (Arrange mode), or stop. */
  arrange?(on: boolean): void;
  /** Show the folder's subfolders' notes too, or not (backlog #42). */
  nest?(on: boolean): void;
}

/**
 * How rows move (backlog #12, Settings / Writing / Lists, Arranging). `mode`:
 * only while arranging, started from the list's head; else whenever your
 * order shows. `on`: arranging now, the lens set aside, grips on the rows.
 */
export interface Arrange {
  readonly mode: boolean;
  readonly on: boolean;
}

export const NO_ARRANGE: Arrange = { mode: false, on: false };

/** Whether the list shows your order, nothing filtered out: a folder's, or All Notes'. */
export const inOwnOrder = (list: NoteList): boolean =>
  list.sort === 'order' &&
  !(list.filter !== undefined && filtering(list.filter)) &&
  (list.folder !== undefined || list.kind === 'all');

/** Whether rows can be dragged into place: in your order, and arranging if that's how it's set. */
export const canDrag = (list: NoteList, arrange: Arrange): boolean =>
  inOwnOrder(list) && (!arrange.mode || arrange.on);

/** The sort a list has when none is chosen: its own order where it has one. */
export const ownSort = (list: NoteList): NoteSort =>
  list.sorts.includes('order') ? 'order' : 'modified';

const iconButton = (
  name: 'sort' | 'filter' | 'subfolders',
  label: string,
  tip: string,
  run: (button: HTMLButtonElement) => void,
  extra: Record<string, string | undefined> = {},
) => {
  const button: HTMLButtonElement = h(
    'button',
    {
      class: `icon-button icon-button--quiet list__${name}`,
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
export function lensParts(
  list: NoteList,
  actions: LensActions,
  where = 'list',
  arrange: Arrange = NO_ARRANGE,
): LensParts {
  if (list.kind === 'search' || list.sorts.length === 0 || !list.sort) {
    return { controls: [], chips: null };
  }
  // Arrange mode: the grip starts arranging and Done stops it; while it's on, the lens waits.
  const arranger =
    arrange.mode && list.sorts.includes('order') && actions.arrange
      ? h(
          'button',
          {
            class: 'icon-button icon-button--quiet list__arrange',
            attrs: {
              type: 'button',
              'aria-label': arrange.on ? 'Done arranging' : 'Arrange',
              'data-tip': arrange.on ? 'Done arranging' : 'Arrange: drag rows to reorder them',
              'aria-pressed': String(arrange.on),
              'data-key': `lens-arrange:${where}`,
            },
            on: { click: () => actions.arrange?.(!arrange.on) },
          },
          icon('grip'),
        )
      : null;
  // Not a lens: your order holds with it on, so it stays while arranging. Only where it'd change something.
  const nested = list.nested;
  const nester =
    nested !== undefined && actions.nest
      ? iconButton(
          'subfolders',
          'Include subfolders',
          'Include subfolders',
          () => actions.nest?.(!nested),
          { 'aria-pressed': String(nested), 'data-key': `lens-subfolders:${where}` },
        )
      : null;
  const kept = [arranger, nester].filter((control) => control !== null);
  if (arrange.on && arranger) return { controls: kept, chips: null };
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
    controls: [...kept, filterButton, sortButton],
    chips: parts.length > 0 ? h('div', { class: 'list__lens' }, ...parts) : null,
  };
}

/** Under the head, why rows don't drag: a lens is on, or (Arrange mode) arranging isn't. */
export function lensLine(list: NoteList, arrange: Arrange = NO_ARRANGE): HTMLElement | null {
  if (arrange.on || !list.sorts.includes('order')) return null;
  const orderable = list.folder !== undefined || list.kind === 'all';
  const text = !orderable
    ? null
    : !inOwnOrder(list)
      ? 'Clear your sort or filters above to restore your order.'
      : arrange.mode
        ? 'This is your order. Choose Arrange to move notes.'
        : null;
  return text ? h('p', { class: 'list__locked', text }) : null;
}
