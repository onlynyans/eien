// What a row that opens has, in FOLDERS and TAGS as on SHELF: the twisty
// beside it, and its rows in a group under it.

import { h } from '../dom';
import { atDepth } from './depth';

/** The disclosure triangle, drawn so it turns (to its button's aria-expanded) rather than swaps. */
export const twisty = (): HTMLElement =>
  h('span', { class: 'twisty', attrs: { 'aria-hidden': 'true' } });

/**
 * The twisty as a row's own button: it opens the row, or closes it. `pointer`
 * when the row's name does the same (SHELF's folders): one control for the
 * keyboard and assistive tech, the twisty a target for the pointer alone,
 * which never takes the keyboard from where it is.
 */
export const twistButton = (
  key: string,
  open: boolean,
  name: string,
  toggle: () => void,
  pointer = false,
): HTMLElement =>
  h(
    'button',
    {
      class: 'tree-row__twist',
      attrs: {
        type: 'button',
        'aria-expanded': pointer ? undefined : String(open),
        'aria-label': pointer ? undefined : `${open ? 'Close' : 'Open'} ${name}`,
        'aria-hidden': pointer ? 'true' : undefined,
        tabindex: pointer ? '-1' : undefined,
        'data-key': `twist:${key}`,
      },
      on: {
        click: toggle,
        ...(pointer ? { mousedown: (event: MouseEvent) => event.preventDefault() } : {}),
      },
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
