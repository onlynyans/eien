// A row on SHELF (#40), a book's, a folder's or one under a book's: the
// tree's own row, its twisty's place kept, at its depth; and its name, a
// button with its lasting key.

import { h, type Props } from '../dom';
import { atDepth } from './depth';

/** A SHELF row of `kind` at `depth`, holding `inner`, with its twisty or the place one would be. */
export const shelfRow = (depth: number, inner: HTMLElement, kind: string, twist?: HTMLElement) =>
  atDepth(
    h(
      'li',
      { class: `tree-row tree-row--${kind}` },
      twist ?? h('span', { class: 'tree-row__twist' }),
      inner,
    ),
    depth,
  );

/** A row's name: a button by its lasting `key`, marked `current` where it's the one on the page. */
export const shelfButton = (
  key: string,
  label: string,
  current: boolean,
  on: Props['on'],
  attrs: Record<string, string> = {},
) =>
  h(
    'button',
    {
      class: 'tree-row__name',
      attrs: {
        type: 'button',
        'data-key': key,
        'aria-current': current ? 'true' : undefined,
        ...attrs,
      },
      on,
    },
    h('span', { class: 'tree-row__label', text: label }),
  );
