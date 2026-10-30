// What a row that opens has, in FOLDERS and TAGS as on SHELF: the twisty
// beside it, and its rows in a group under it.

import { h } from '../dom';
import { atDepth } from './depth';

/** The disclosure triangle, drawn so it turns (to its button's aria-expanded) rather than swaps. */
export const twisty = (): HTMLElement =>
  h('span', { class: 'twisty', attrs: { 'aria-hidden': 'true' } });

/** The twisty as a row's own button: it opens the row, or closes it. */
export const twistButton = (
  key: string,
  open: boolean,
  name: string,
  toggle: () => void,
): HTMLElement =>
  h(
    'button',
    {
      class: 'tree-row__twist',
      attrs: {
        type: 'button',
        'aria-expanded': String(open),
        'aria-label': `${open ? 'Close' : 'Open'} ${name}`,
        'data-key': `twist:${key}`,
      },
      on: { click: toggle },
    },
    twisty(),
  );

/**
 * An open row's rows, in a group of their own at the row's depth: the
 * hairline guide down its children runs down the group (spec §4; the
 * mockup's `.tree [role='group']`). Nothing under it, no group.
 */
export const group = (depth: number, rows: HTMLElement[]): HTMLElement[] =>
  rows.length > 0
    ? [atDepth(h('li', { class: 'tree-group' }, h('ul', { class: 'tree' }, ...rows)), depth)]
    : [];
