// The page pane: the slots the layout draws its controls in (../chrome): the
// bar above, the formatting bar's row under it and a phone's foot; the
// colophon beneath, and the versions panel beside. The pages lie in it
// (./page.ts): one, or two when the window is split. The pane's colophon,
// running head and versions panel are the active page's.

import { h } from '../dom';
import type { PageView } from './page';

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
  /** Where the pages lie, in the pane's page row. */
  readonly #pages = h('div', { class: 'page__pages' });
  /** In the colophon, after the save state: today's words, the book's, a sprint (ui/counters). */
  readonly #counters = h('span', { class: 'colophon__counters' });
  readonly #zoom = h('span', { class: 'colophon__zoom', attrs: { 'aria-label': 'Zoom' } });
  /** News from the last action, when neither the list nor the sidebar is there to show it. */
  readonly #news = h('span', { class: 'colophon__news', attrs: { role: 'status' } });
  readonly #colophon = h('footer', { class: 'colophon count' });
  #active: PageView;

  /** The pane in `area`, `first` its active page (made with `area` as its layer). */
  constructor(area: HTMLElement, first: PageView) {
    this.#active = first;
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
  }

  get active(): PageView {
    return this.#active;
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
