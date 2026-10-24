// The page pane: the slots the layout draws its controls in (../chrome): the
// bar above, the formatting bar's row under it and a phone's foot; the
// colophon beneath, and the versions panel beside. The pages lie in its row
// (./pages-row.ts): one, or two when the window is split. The pane's running
// head and versions panel are the active page's; so is the colophon, unless
// the split's mode puts each note's figures at its own page's foot.

import type { SplitSpec } from '../chrome/splits';
import { h } from '../dom';
import type { PageView } from './page';
import { PagesRow, type RowEvents } from './pages-row';

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
  readonly #row: PagesRow;
  /** In the colophon, after the save state: today's words, the book's, a sprint (ui/counters). */
  readonly #counters = h('span', { class: 'colophon__counters' });
  readonly #zoom = h('span', { class: 'colophon__zoom', attrs: { 'aria-label': 'Zoom' } });
  /** News from the last action, when neither the list nor the sidebar is there to show it. */
  readonly #news = h('span', { class: 'colophon__news', attrs: { role: 'status' } });
  readonly #colophon = h('footer', { class: 'colophon count' });
  /** The pane's grid: its slots, the pages' row, the colophon. */
  readonly #main = h('div', { class: 'page__main' });
  #active: PageView;

  /** The pane in `area`, `first` its active page (made with `area` as its layer). */
  constructor(area: HTMLElement, first: PageView, events: RowEvents) {
    this.#active = first;
    this.#row = new PagesRow(this.#main, events);
    this.head = h('div', { class: 'window-head' }, first.runningCrumbs);
    this.#row.element.append(first.element);
    first.element.toggleAttribute('data-active', true); // the one page is the active one
    this.#main.append(
      this.slots.bar,
      this.slots.format,
      this.#row.element,
      first.tableBar.element,
      this.#colophon,
      this.slots.phone,
    );
    // Before what the page put in the area already (its selection bar, which floats).
    area.prepend(this.#main, first.aside);
    this.#placeFigures([first], 'active');
    // # on the pane, outside the words and any field, opens the active page's tags.
    area.addEventListener('keydown', (event) => this.#active.tags.key(event));
  }

  get active(): PageView {
    return this.#active;
  }

  /** Where the pages lie: a note dropped there opens on one (../vault/page-drop.ts). */
  get pagesArea(): HTMLElement {
    return this.#row.element;
  }

  /** The divider, while two pages show: for its tooltip. */
  get divider(): HTMLElement {
    return this.#row.divider;
  }

  /** Folded, the two pages by name: the layout puts it with the page's tools. */
  get pager(): HTMLElement {
    return this.#row.pager;
  }

  /**
   * Lay `pages` in the pane, left to right (one, or two as `split` lays them
   * out), `active` the one the tools, the colophon and the panel are for.
   */
  place(pages: readonly PageView[], active: PageView, split: SplitSpec): void {
    this.#row.place(pages, active, split);
    if (active !== this.#active && split.follows && pages.length === 2) this.#arrive();
    if (active !== this.#active) {
      // The active page's parts take the pane's places: one node each, swapped in place.
      this.#active.runningCrumbs.replaceWith(active.runningCrumbs);
      this.#active.tableBar.element.replaceWith(active.tableBar.element);
      this.#active.aside.replaceWith(active.aside);
      this.#active = active;
    }
    this.#placeFigures(pages, pages.length === 2 ? split.figures : 'active');
  }

  /** The furniture moved across to the page now active: it fades in there (none with reduced motion). */
  #arrive(): void {
    this.#main.classList.remove('is-arriving');
    void this.#main.offsetWidth; // the animation runs again only from a style without it
    this.#main.classList.add('is-arriving');
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

  /** The pages' notes changed (one opened, renamed): the names they're called by say it. */
  renamed(): void {
    this.#row.renamed();
  }

  stop(): void {
    this.#row.stop();
  }

  /**
   * Each note's figures: its words, save and last seal, as the split says
   * (../chrome/splits.ts). In the colophon, its tags first and the counters
   * between, in the order a single page always had: the active note's, or
   * the first page's with the second's at its own foot; or each at its own
   * page's foot, the colophon keeping the book's figures and today's.
   */
  #placeFigures(pages: readonly PageView[], where: SplitSpec['figures']): void {
    const onFoot = where === 'pages' ? pages : where === 'second' ? pages.slice(1) : [];
    for (const page of pages) {
      const { words, state, seal } = page.foot;
      if (onFoot.includes(page)) page.folio.figures.replaceChildren(words, state, seal);
      else page.folio.figures.replaceChildren();
    }
    if (where === 'pages') {
      this.#colophon.replaceChildren(
        this.#counters,
        this.#zoom,
        this.#news,
        this.#active.foot.said,
      );
      return;
    }
    const { foot } = where === 'second' ? (pages[0] ?? this.#active) : this.#active;
    this.#colophon.replaceChildren(
      foot.tags,
      foot.words,
      foot.state,
      this.#counters,
      foot.seal,
      this.#zoom,
      this.#news,
      this.#row.waits,
      foot.said,
    );
  }
}
