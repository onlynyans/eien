// A book's fore-edge in pages (#40, Phase 3b, Pages 2): under the sheet, the
// pages still to read stack at its right edge and the pages read at its
// left, up to six paper edges a mark's width apart, so how far you are shows
// before any number. The edges are where a hand reaches to turn: each side
// is a button, Previous page or Next page, its tooltip saying how many pages
// of the chapter are left that way. In Scroll, and in Page frame Full, they
// aren't drawn (./epub.css).

import { EDGES, edgesOf } from '../../core/epub';
import { keyText } from '../chrome/keys';
import { h } from '../dom';
import { STAYS } from './turn/page-copy';

const MAC = /Mac|iPhone|iPad/.test(navigator.platform);

type Side = 'before' | 'after';

const pagesWord = (count: number) => `${count} ${count === 1 ? 'page' : 'pages'}`;

export class LeafEdges {
  // The book's edge stays where it is as a page turns: a turn's copies leave it out.
  readonly element = h('div', { class: 'epub-edges', attrs: { [STAYS]: true } });
  readonly #stacks: Record<Side, HTMLElement>;
  readonly #buttons: Record<Side, HTMLButtonElement>;

  constructor(turn: (way: 1 | -1) => void) {
    const side = (name: Side, way: 1 | -1, label: string, key: string) => {
      const stack = h('span', {
        class: `epub-edges__stack epub-edges__stack--${name}`,
        attrs: { 'aria-hidden': 'true' },
      });
      const button = h('button', {
        class: `epub-edges__turn epub-edges__turn--${name}`,
        attrs: {
          type: 'button',
          'aria-label': label,
          'data-tip': label,
          'data-shortcut': keyText(key, MAC),
        },
        on: { click: () => turn(way) },
      });
      this.element.append(stack, button);
      return { stack, button };
    };
    const before = side('before', -1, 'Previous page', 'ArrowLeft');
    const after = side('after', 1, 'Next page', 'ArrowRight');
    this.#stacks = { before: before.stack, after: after.stack };
    this.#buttons = { before: before.button, after: after.button };
  }

  /** The edges' tooltips' and buttons' controls, for the page's tooltips. */
  get turns(): readonly HTMLElement[] {
    return [this.#buttons.before, this.#buttons.after];
  }

  /**
   * `through` (0 to 1) the book, on page `at` of the chapter's `of`: the edges
   * either side, and each button's word of how many pages are left that way.
   */
  through(book: number, at: number, of: number): void {
    for (const name of ['before', 'after'] as const) {
      const stack = this.#stacks[name];
      const count = edgesOf(book, name === 'before');
      if (stack.childElementCount !== count) {
        stack.replaceChildren(
          ...Array.from({ length: Math.min(count, EDGES) }, (_, i) => {
            // Set through the style object, as the window's content security policy allows.
            const edge = h('span', { class: 'epub-edges__edge' });
            edge.style.setProperty('--edge', String(i + 1));
            return edge;
          }),
        );
      }
      const left = name === 'before' ? at : Math.max(0, of - at - 1);
      const label = name === 'before' ? 'Previous page' : 'Next page';
      const tip = `${label} · ${pagesWord(left)} ${name === 'before' ? 'back' : 'on'} in the chapter`;
      this.#buttons[name].dataset.tip = tip;
    }
  }
}
