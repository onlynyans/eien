// The tag filter's panel (docs/design/explorations/order.md): the vault's
// tags, each left alone (an empty box), wanted (a filled box, a tick) or kept
// out (a carmine box, a dash, the name struck through). A press moves a tag
// on to the next state, and ⌥ with a press keeps it out at once. With two or
// more wanted, All of or Any of decides. Every note clears them all. The
// panel stays open while the list under it changes; Esc or a click elsewhere
// closes it, and the keyboard goes back to the filter's button.

import {
  filtering,
  NO_FILTER,
  nextState,
  stateOf,
  type TagFilter,
  type TagNode,
  withTagState,
} from '../../core/tags';
import { h } from '../dom';
import { icon } from '../icons';
import { float } from '../menu/menu';

export interface FilterTag {
  /** As shown: "fic/aot". */
  readonly tag: string;
  /** Case aside: what the filter keeps. */
  readonly key: string;
  readonly count: number;
  /** How deep it's nested: "fic/aot" is 1. */
  readonly depth: number;
}

/** The vault's tag tree, flattened for the panel: each tag after the one it's nested in. */
export function filterTags(nodes: readonly TagNode[], depth = 0): FilterTag[] {
  return nodes.flatMap((node) => [
    { tag: node.tag, key: node.key, count: node.count, depth },
    ...filterTags(node.children, depth + 1),
  ]);
}

export interface FilterPanelActions {
  filter(next: TagFilter): void;
  tags(): readonly FilterTag[];
}

const SAID = { in: 'wanted', out: 'kept out', none: 'left alone' } as const;

/** Open the tag filter under `opener`, starting from `filter`. */
export function openTagFilter(
  opener: HTMLElement,
  filter: TagFilter | undefined,
  actions: FilterPanelActions,
): void {
  let now = filter ?? NO_FILTER;
  const panel = h('div', {
    class: 'menu tag-filter',
    attrs: { role: 'dialog', 'aria-label': 'Filter by tag' },
  });
  const change = (next: TagFilter) => {
    now = next;
    actions.filter(next);
    draw();
  };
  const draw = () => {
    const was = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const at = was?.dataset.tri;
    const matchWas = was?.dataset.match;
    const match = (value: 'all' | 'any', words: string) =>
      h('button', {
        class: 'word-button',
        text: words,
        attrs: { type: 'button', 'aria-pressed': String(now.match === value), 'data-match': value },
        on: { click: () => change({ ...now, match: value }) },
      });
    const tags = actions.tags();
    const rows = tags.map((tag) => {
      const state = stateOf(now, tag.key);
      const button = h(
        'button',
        {
          class: 'tri',
          attrs: {
            type: 'button',
            'data-tri': tag.key,
            'data-state': state ?? 'none',
            'aria-label': `#${tag.tag}: ${SAID[state ?? 'none']}`,
          },
          on: {
            click: (event) => change(withTagState(now, tag.key, nextState(state, event.altKey))),
          },
        },
        h('span', { class: 'tri__box' }, icon(state === 'out' ? 'exclude' : 'check')),
        h('span', { class: 'tri__name', text: `#${tag.tag}` }),
        h('span', { class: 'count', text: tag.count.toLocaleString() }),
      );
      if (tag.depth) button.style.setProperty('--depth', String(tag.depth));
      return button;
    });
    panel.replaceChildren(
      h(
        'div',
        { class: 'tag-filter__head' },
        h('span', { class: 'label', text: 'Tags' }),
        h(
          'span',
          { class: 'tag-filter__match', attrs: { role: 'group', 'aria-label': 'Match' } },
          match('all', 'All of'),
          match('any', 'Any of'),
        ),
      ),
      ...(rows.length > 0
        ? rows
        : [h('p', { class: 'tag-filter__none', text: 'No tags in this vault yet.' })]),
      ...(filtering(now)
        ? [
            h('div', { class: 'menu__rule', attrs: { role: 'separator' } }),
            h('button', {
              class: 'word-button',
              text: 'Every note',
              attrs: { type: 'button', 'data-key': 'every-note' },
              on: { click: () => change({ ...now, tags: [] }) },
            }),
          ]
        : []),
    );
    // The press redrew the panel: the keyboard stays on the tag it was on, or on All of or Any of;
    // after Every note, which goes with the filter, on the first tag.
    const back =
      (at ? panel.querySelector<HTMLElement>(`[data-tri="${CSS.escape(at)}"]`) : null) ??
      (matchWas ? panel.querySelector<HTMLElement>(`[data-match="${matchWas}"]`) : null) ??
      (panel.isConnected ? panel.querySelector<HTMLElement>('.tri, button') : null);
    back?.focus();
  };
  panel.addEventListener('keydown', (event) => {
    const buttons = [...panel.querySelectorAll<HTMLButtonElement>('button')];
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const step = (by: number) => buttons[(index + by + buttons.length) % buttons.length]?.focus();
    if (event.key === 'ArrowDown') step(1);
    else if (event.key === 'ArrowUp') step(-1);
    else if (event.key === 'Escape') close();
    else if (
      event.key === 'Enter' &&
      event.altKey &&
      document.activeElement instanceof HTMLElement
    ) {
      const key = document.activeElement.dataset.tri;
      if (key) change(withTagState(now, key, nextState(stateOf(now, key), true)));
    } else return;
    event.preventDefault();
    event.stopPropagation();
  });
  draw();
  // The list under the panel draws again with each press, its button too: closed, the keyboard
  // goes to the button drawn now, found by its lasting key.
  const close = float(panel, { opener }, () => {
    const now = opener.isConnected
      ? opener
      : document.querySelector<HTMLElement>(`[data-key="${CSS.escape(opener.dataset.key ?? '')}"]`);
    now?.setAttribute('aria-expanded', 'false');
    if (now && document.activeElement === document.body) now.focus();
  });
  opener.setAttribute('aria-expanded', 'true');
  (panel.querySelector<HTMLElement>('.tri') ?? panel.querySelector<HTMLElement>('button'))?.focus();
}
