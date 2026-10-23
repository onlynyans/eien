// A page's frame in the pane (./page.ts): its scroll, and round it its own
// head and foot, which only some split modes fill (../chrome/splits.ts): a
// companion's head (its name and its few tools), a folio at the foot (its
// figures and its tools). Empty, they take no room (./split.css).

import { h } from '../dom';

export interface PageLeaf {
  readonly element: HTMLElement;
  /** The page's own head: its note's name, and its own tools. */
  readonly head: { readonly name: HTMLElement; readonly tools: HTMLElement };
  /** The page's own foot: its note's figures, and its own tools. */
  readonly folio: { readonly figures: HTMLElement; readonly tools: HTMLElement };
}

export function pageLeaf(scroll: HTMLElement): PageLeaf {
  const head = {
    name: h('span', { class: 'page__name' }),
    tools: h('span', { class: 'page__tools' }),
  };
  const folio = {
    figures: h('span', { class: 'page__figures' }),
    tools: h('span', { class: 'page__tools' }),
  };
  const element = h(
    'div',
    { class: 'page__leaf' },
    h('div', { class: 'page__head' }, head.name, head.tools),
    scroll,
    h('footer', { class: 'page__folio count' }, folio.figures, folio.tools),
  );
  return { element, head, folio };
}
