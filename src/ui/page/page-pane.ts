// The page pane: the slots the layout draws its controls in (../chrome): the
// bar above, the formatting bar's row under it and a phone's foot; the
// colophon beneath, and the versions panel beside. The pages lie in it
// (./page.ts): one, or two side by side when the window is split, the
// divider between them (./divider.ts). The pane's colophon, running head and
// versions panel are the active page's. Too narrow for two pages, they fold
// into one, the active one, and a pager names both.

import { h, wordButton } from '../dom';
import { twoFit } from '../shell/split-state';
import { Divider } from './divider';
import type { PageView } from './page';

export interface PaneEvents {
  /** A page chosen in the pager (folded): it becomes the active one. */
  activate(page: PageView): void;
  /** ⇄ on the divider. */
  swap(): void;
}

export class PagePane {
  /** Where the layout draws its controls (../chrome/layout-spec.ts): each part has its own row. */
  readonly slots = {
    bar: h('div', { class: 'page__bar' }),
    /** The formatting bar's row; empty until it's built. */
    format: h('div', { class: 'page__format' }),
    /** On a phone, the page's tools at its foot (B's slip, C's rail). */
    phone: h('div', { class: 'page__phone' }),
  };
  /** The window's running head (C's): the layout's hosts, and the active page's crumbs. */
  readonly head: HTMLElement;
  /** Folded, the two pages by name; the layout puts it with the page's tools (../chrome). */
  readonly pager = h('span', {
    class: 'page__pager',
    attrs: { role: 'group', 'aria-label': 'The two pages', hidden: true },
  });
  /** Where the pages lie, in the pane's page row. */
  readonly #pages = h('div', { class: 'page__pages' });
  readonly #divider: Divider;
  /** In the colophon, after the save state: today's words, the book's, a sprint (ui/counters). */
  readonly #counters = h('span', { class: 'colophon__counters' });
  readonly #zoom = h('span', { class: 'colophon__zoom', attrs: { 'aria-label': 'Zoom' } });
  /** News from the last action, when neither the list nor the sidebar is there to show it. */
  readonly #news = h('span', { class: 'colophon__news', attrs: { role: 'status' } });
  readonly #colophon = h('footer', { class: 'colophon count' });
  readonly #events: PaneEvents;
  #shown: readonly PageView[];
  #active: PageView;
  /** The pages' width, as last laid out: only a change lays them out again. */
  #width = -1;
  readonly #resized = new ResizeObserver(() => this.#layout());

  /** The pane in `area`, `first` its active page (made with `area` as its layer). */
  constructor(area: HTMLElement, first: PageView, events: PaneEvents) {
    this.#events = events;
    this.#active = first;
    this.#shown = [first];
    this.#divider = new Divider({
      width: () => this.#pages.clientWidth,
      moved: () => this.#layout(true),
      swap: () => events.swap(),
    });
    this.head = h('div', { class: 'window-head' }, first.runningCrumbs);
    this.#pages.append(first.element);
    // Before what the page put in the area already (its selection bar, which floats).
    area.prepend(
      h(
        'div',
        { class: 'page__main' },
        this.slots.bar,
        this.slots.format,
        this.#pages,
        first.tableBar.element,
        this.#colophon,
        this.slots.phone,
      ),
      first.aside,
    );
    this.#fillColophon();
    // # on the pane, outside the words and any field, opens the active page's tags.
    area.addEventListener('keydown', (event) => this.#active.tags.key(event));
    this.#resized.observe(this.#pages);
  }

  get active(): PageView {
    return this.#active;
  }

  /** Where the pages lie: a note dropped there opens on one (../vault/page-drop.ts). */
  get pagesArea(): HTMLElement {
    return this.#pages;
  }

  /** The divider, while two pages show: for its tooltip. */
  get divider(): HTMLElement {
    return this.#divider.element;
  }

  /**
   * Lay `pages` in the pane, left to right (one, or two with the divider
   * between), `active` the one the tools, the colophon and the panel are for.
   * A page already in place stays put, so the keyboard stays where it is.
   */
  place(pages: readonly PageView[], active: PageView): void {
    const [left, right] = pages;
    if (!left) return;
    const want = right ? [left.element, this.#divider.element, right.element] : [left.element];
    const have = [...this.#pages.children];
    if (want.length !== have.length || want.some((part, at) => part !== have[at]))
      this.#pages.replaceChildren(...want);
    this.#shown = pages;
    this.#pages.toggleAttribute('data-two', right !== undefined);
    for (const page of pages) page.element.toggleAttribute('data-active', page === active);
    if (!right) for (const part of ['role', 'aria-label']) left.element.removeAttribute(part);
    if (active !== this.#active) {
      // The active page's parts take the pane's places: one node each, swapped in place.
      this.#active.runningCrumbs.replaceWith(active.runningCrumbs);
      this.#active.tableBar.element.replaceWith(active.tableBar.element);
      this.#active.aside.replaceWith(active.aside);
      this.#active = active;
      this.#fillColophon();
    }
    this.#name();
    this.#layout(true);
  }

  /** Two pages: each a region named for its note, and which is the active one. */
  #name(): void {
    if (this.#shown.length < 2) return;
    for (const page of this.#shown) {
      page.element.setAttribute('role', 'region');
      page.element.setAttribute(
        'aria-label',
        `${page.name || 'No note'}${page === this.#active ? ', the active page' : ''}`,
      );
    }
  }

  /** News from the last action in the status line; null takes it away. */
  news(text: string | null): void {
    this.#news.textContent = text ?? '';
  }

  /** Today's words, the book's and a sprint, in the colophon. */
  counters(element: HTMLElement): void {
    this.#counters.replaceChildren(element);
  }

  /** The page's zoom, in the colophon when it isn't 100%. */
  showZoom(percent: number): void {
    this.#zoom.textContent = percent === 100 ? '' : `${percent}%`;
  }

  /** The pages' notes changed (one opened, renamed): the pager and the pages' names say them as they are. */
  renamed(): void {
    if (!this.pager.hidden) this.#drawPager();
    this.#name();
  }

  stop(): void {
    this.#resized.disconnect();
  }

  /** Two pages side by side where they fit, the divider where it stands; else folded. */
  #layout(force = false): void {
    const width = this.#pages.clientWidth;
    if (!force && width === this.#width) return;
    this.#width = width;
    const two = this.#shown.length === 2;
    const folded = two && !twoFit(width);
    this.#pages.toggleAttribute('data-folded', folded);
    this.pager.hidden = !folded;
    if (folded) this.#drawPager();
    if (two && !folded) {
      const share = this.#divider.shown(width);
      this.#pages.style.setProperty('--split-share', String(share));
    }
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

  /** The colophon in its order: the active note's words and save, the counters, its seal, the rest. */
  #fillColophon(): void {
    const { foot } = this.#active;
    this.#colophon.replaceChildren(
      foot.tags,
      foot.words,
      foot.state,
      this.#counters,
      foot.seal,
      this.#zoom,
      this.#news,
      foot.said,
    );
  }
}
