// The pages' row in the page pane (./page-pane.ts): one page, or two side by
// side with the divider between them (./divider.ts), as the split's mode
// lays them out (../chrome/splits.ts). Too narrow for two side by side, they
// fold into the active one with a pager naming both, or the book closes to it
// with the other page's edge beside it to turn to, or the second goes under
// the first. Facing pages mark the active page.

import { ariaKeys, keyText } from '../chrome/keys';
import type { SplitSpec } from '../chrome/splits';
import { h, wordButton } from '../dom';
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
  /** Too narrow for two, with Tools that follow: the colophon's word that the other page waits. */
  readonly waits = h('span', { class: 'colophon__waits' });
  /** Where the split's share is worn, and the furniture told which page to stand over: the pane's main grid. */
  readonly #wear: HTMLElement;
  readonly #edge: HTMLButtonElement;
  readonly #mark = markOf();
  readonly #divider: Divider;
  readonly #events: RowEvents;
  #shown: readonly PageView[] = [];
  #active: PageView | null = null;
  #spec: SplitSpec | null = null;
  /** The row's size, as last laid out: only a change lays the pages out again. */
  #size = '';
  readonly #resized = new ResizeObserver(() => this.#layout());

  constructor(wear: HTMLElement, events: RowEvents) {
    this.#wear = wear;
    this.#events = events;
    this.#divider = new Divider({
      room: () => this.#roomNow(this.element.dataset.dock === 'under' ? 'y' : 'x'),
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
      page.head.name.textContent = page.name;
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
    // Drawn whether it's in sight or not: folding and unfolding only shows and hides it (#44).
    this.#drawPager();
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

  /** The pages' room along `axis`: the row's size less the divider's track (--split-gap, the mode's). */
  #roomNow(axis: 'x' | 'y'): number {
    const gap = Number.parseFloat(getComputedStyle(this.element).getPropertyValue('--split-gap'));
    const size = axis === 'x' ? this.element.clientWidth : this.element.clientHeight;
    return size - (Number.isFinite(gap) ? gap : 0);
  }

  /**
   * Two pages side by side where they fit, the divider where it stands; else
   * as the mode says: one page (folded or closed), or the second under the first.
   */
  #layout(force = false): void {
    const size = `${this.element.clientWidth}×${this.element.clientHeight}`;
    if (!force && size === this.#size) return;
    this.#size = size;
    const spec = this.#spec;
    const narrow = spec && this.#roomNow('x') < spec.least ? spec.narrow : null;
    const under = narrow === 'under' && spec?.under ? spec.under : null;
    const one = narrow === 'under' ? null : narrow;
    if (one) this.element.dataset.narrow = one;
    else delete this.element.dataset.narrow;
    if (under) this.element.dataset.dock = 'under';
    else delete this.element.dataset.dock;
    this.pager.hidden = one !== 'fold';
    const other = this.#other();
    this.waits.textContent =
      one === 'wait' && other
        ? `${other.name || 'The other page'} waits · ${keyText('Mod-\\', MAC)} makes room`
        : '';
    // The pane's furniture over the active page, by grid: two pages shown, and a mode that has it.
    const follows = spec?.follows && !one && this.#active ? this.#shown.indexOf(this.#active) : -1;
    if (follows >= 0) this.#wear.dataset.followSide = String(follows);
    else delete this.#wear.dataset.followSide;
    if (!spec || one) return;
    const measure = under ?? spec.measure;
    this.#divider.use(measure);
    const share = this.#divider.shown(this.#roomNow(measure.axis));
    this.#wear.style.setProperty('--split-share', String(share));
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
