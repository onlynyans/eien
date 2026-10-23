// The pages' row in the page pane (./page-pane.ts): one page, or two side by
// side with the divider between them (./divider.ts), as the split's mode
// lays them out (../chrome/splits.ts). Too narrow for two, they fold into
// the active one with a pager naming both, or the book closes to it with the
// other page's edge beside it to turn to. Facing pages mark the active page.

import { ariaKeys } from '../chrome/keys';
import type { SplitSpec } from '../chrome/splits';
import { h, wordButton } from '../dom';
import { twoFit } from '../shell/split-state';
import { Divider } from './divider';
import type { PageView } from './page';

export interface RowEvents {
  /** A page chosen in the pager, or turned to by its edge: it becomes the active one. */
  activate(page: PageView): void;
  /** ⇄ on the divider. */
  swap(): void;
}

const SVG = 'http://www.w3.org/2000/svg';
const MAC = /Mac|iPhone|iPad/.test(navigator.platform);

/** The mark on the active page (Facing pages'): the ribbon or the tab is the span; a dog-ear is its drawing. */
function markOf(): HTMLElement {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  // The corner gone to the blotter, and the flap folded over the page, along the diagonal.
  for (const [part, points] of [
    ['page__mark-gone', '0,0 24,0 0,24'],
    ['page__mark-flap', '24,0 24,24 0,24'],
  ]) {
    const polygon = document.createElementNS(SVG, 'polygon');
    polygon.setAttribute('class', part as string);
    polygon.setAttribute('points', points as string);
    svg.append(polygon);
  }
  return h('span', { class: 'page__mark', attrs: { 'aria-hidden': 'true' } }, svg);
}

export class PagesRow {
  readonly element = h('div', { class: 'page__pages' });
  /** Folded, the two pages by name; the layout puts it with the page's tools (../chrome). */
  readonly pager = h('span', {
    class: 'page__pager',
    attrs: { role: 'group', 'aria-label': 'The two pages', hidden: true },
  });
  readonly #edgeName = h('span', { class: 'page__edge-name label' });
  readonly #edge: HTMLButtonElement;
  readonly #mark = markOf();
  readonly #divider: Divider;
  readonly #events: RowEvents;
  #shown: readonly PageView[] = [];
  #active: PageView | null = null;
  #spec: SplitSpec | null = null;
  /** The pages' room, as last laid out: only a change lays them out again. */
  #room = -1;
  readonly #resized = new ResizeObserver(() => this.#layout());

  constructor(events: RowEvents) {
    this.#events = events;
    this.#divider = new Divider({
      width: () => this.#roomNow(),
      moved: () => this.#layout(true),
      swap: () => events.swap(),
    });
    this.#edge = h(
      'button',
      {
        class: 'page__edge',
        attrs: { type: 'button', 'aria-keyshortcuts': ariaKeys('Mod-3', MAC) },
        on: { click: () => this.#turn() },
      },
      this.#edgeName,
    );
    this.#resized.observe(this.element);
  }

  get divider(): HTMLElement {
    return this.#divider.element;
  }

  /**
   * Lay `pages` in the row, left to right, `active` the one the tools are
   * for; with two, as `spec` lays them out. A page already in place stays
   * put, so the keyboard stays where it is.
   */
  place(pages: readonly PageView[], active: PageView, spec: SplitSpec): void {
    const [left, right] = pages;
    if (!left) return;
    const want = right
      ? [left.element, this.#divider.element, right.element, this.#edge]
      : [left.element];
    const have = [...this.element.children];
    if (want.length !== have.length || want.some((part, at) => part !== have[at]))
      this.element.replaceChildren(...want);
    this.#shown = pages;
    this.#active = active;
    this.#spec = right ? spec : null;
    this.element.toggleAttribute('data-two', right !== undefined);
    this.element.dataset.activeSide = String(pages.indexOf(active));
    pages.forEach((page, side) => {
      page.element.toggleAttribute('data-active', page === active);
      if (right) page.element.dataset.side = String(side);
      else delete page.element.dataset.side;
    });
    // The mark goes into the active page anew, so it arrives there as it moves.
    if (right && spec.mark) {
      if (this.#mark.parentElement !== active.element) active.element.append(this.#mark);
    } else this.#mark.remove();
    this.renamed();
    this.#layout(true);
  }

  /** The pages' notes changed (one opened, renamed): every name they're called by says it. */
  renamed(): void {
    const two = this.#shown.length === 2;
    for (const page of this.#shown) {
      if (!two) {
        page.element.removeAttribute('role');
        page.element.removeAttribute('aria-label');
        continue;
      }
      page.element.setAttribute('role', 'region');
      page.element.setAttribute(
        'aria-label',
        `${page.name || 'No note'}${page === this.#active ? ', the active page' : ''}`,
      );
    }
    if (!this.pager.hidden) this.#drawPager();
    const other = this.#other();
    if (other) {
      const name = other.name || 'No note';
      this.#edgeName.textContent = name;
      this.#edge.setAttribute('aria-label', `Turn to ${name}, the facing page`);
      this.#edge.dataset.tip = `Turn to ${name}`;
    }
  }

  stop(): void {
    this.#resized.disconnect();
  }

  /** The pages' room: the row's width less the divider's column (--split-gap, the mode's). */
  #roomNow(): number {
    const gap = Number.parseFloat(getComputedStyle(this.element).getPropertyValue('--split-gap'));
    return this.element.clientWidth - (Number.isFinite(gap) ? gap : 0);
  }

  /** Two pages side by side where they fit, the divider where it stands; else one, as the mode says. */
  #layout(force = false): void {
    const room = this.#roomNow();
    if (!force && room === this.#room) return;
    this.#room = room;
    const narrow = this.#spec && !twoFit(room) ? this.#spec.narrow : null;
    if (narrow) this.element.dataset.narrow = narrow;
    else delete this.element.dataset.narrow;
    this.pager.hidden = narrow !== 'fold';
    if (narrow === 'fold') this.#drawPager();
    if (this.#spec && !narrow)
      this.element.style.setProperty('--split-share', String(this.#divider.shown(room)));
  }

  #other(): PageView | null {
    return this.#shown.find((page) => page !== this.#active) ?? null;
  }

  #turn(): void {
    const other = this.#other();
    if (other) this.#events.activate(other);
  }

  #drawPager(): void {
    this.pager.replaceChildren(
      ...this.#shown.map((page) =>
        wordButton(page.name || 'No note', () => this.#events.activate(page), {
          'aria-pressed': String(page === this.#active),
        }),
      ),
    );
  }
}
