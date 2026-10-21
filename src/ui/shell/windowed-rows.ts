// A long list that draws only the rows in sight (./window-range.ts): the
// sidebar tree's notes with two panes, and the note list, once either holds
// thousands. Making, styling and laying out six thousand rows held the window
// up for most of a second on a slow machine; this draws a few dozen, with a
// spacer above and below keeping the list its whole height, so the scrollbar,
// guide lines and positions read as if every row were there.
//
// Rows are all one height (measured from a drawn row). A row keeps its
// element while it shows the same; scrolling moves rows in and out without
// touching the rest. The keyboard moves through every row, drawn or not
// (↑ ↓ Home End PageUp PageDown); a row with the keyboard that scrolls out of
// sight leaves it with the list, which carries on from that row.

import { type Range, revealTop, type Viewport, windowRange } from './window-range';

export interface WindowedRow {
  /** The row's lasting name in the list. */
  readonly key: string;
  /** What it shows, as a string: the same string, the same element. */
  readonly shows: string;
  make(): HTMLElement;
}

const NAV_KEYS = new Set(['ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown']);

/** The nearest element at or above `from` that scrolls up and down. */
function scrollerOf(from: HTMLElement): HTMLElement | null {
  for (let node: HTMLElement | null = from; node; node = node.parentElement) {
    if (/(auto|scroll)/.test(getComputedStyle(node).overflowY)) return node;
  }
  return null;
}

const spacer = () => {
  const item = document.createElement('li');
  item.className = 'window-spacer';
  item.setAttribute('aria-hidden', 'true');
  return item;
};

export class WindowedRows {
  /** The list: rows between two spacers. */
  readonly element: HTMLElement;
  readonly #top = spacer();
  readonly #bottom = spacer();
  readonly #estimate: number;
  #rows: readonly WindowedRow[] = [];
  #index = new Map<string, number>();
  /** Elements made, by key, kept while their row shows the same. */
  #made = new Map<string, { shows: string; element: HTMLElement }>();
  #rowHeight = 0;
  #scroller: HTMLElement | null = null;
  #frame = 0;
  /** The row the keyboard was on when it scrolled out of the window: the list holds it meanwhile. */
  #held: string | null = null;
  readonly #resized = new ResizeObserver(() => this.render());
  readonly #onScroll = () => {
    if (this.#frame) return;
    this.#frame = requestAnimationFrame(() => {
      this.#frame = 0;
      this.render();
    });
  };

  /** `estimate`: a row's height before one is drawn to measure. */
  constructor(element: HTMLElement, estimate: number) {
    this.element = element;
    this.#estimate = estimate;
    element.tabIndex = -1;
    element.addEventListener('keydown', (event) => this.#key(event));
    element.append(this.#top, this.#bottom);
  }

  get size(): number {
    return this.#rows.length;
  }

  /** The rows to show now: drawn at once where they're in sight. */
  set(rows: readonly WindowedRow[]): void {
    this.#rows = rows;
    this.#index = new Map(rows.map((row, at) => [row.key, at]));
    for (const key of this.#made.keys()) if (!this.#index.has(key)) this.#made.delete(key);
    if (this.#held !== null && !this.#index.has(this.#held)) this.#held = null;
    this.render();
  }

  /** Draw the rows in sight, for where the list is scrolled to now. */
  render(): void {
    const scroller = this.#attach();
    if (!scroller) return;
    const height = this.#rowHeight || this.#estimate;
    const view = this.#view(scroller);
    const range = windowRange(this.#rows.length, height, view);
    this.#hold(range);
    this.#top.style.setProperty('height', `${range.first * height}px`);
    this.#bottom.style.setProperty('height', `${(this.#rows.length - range.last) * height}px`);
    this.#place(range);
    // Rows are one height: the first one drawn says what it is.
    const drawn = this.#top.nextElementSibling;
    const measured = drawn && drawn !== this.#bottom ? drawn.getBoundingClientRect().height : 0;
    if (measured > 0 && Math.abs(measured - this.#rowHeight) > 0.5) {
      this.#rowHeight = measured;
      this.render();
    }
  }

  /** Bring the row named `key` into sight and give it the keyboard; false if there's none. */
  focusKey(key: string): boolean {
    const at = this.#index.get(key);
    if (at === undefined) return false;
    this.#focusAt(at);
    return true;
  }

  /** The element of the row named `key`, drawn (into sight) if it wasn't; null if there's none. */
  reveal(key: string): HTMLElement | null {
    const at = this.#index.get(key);
    return at === undefined ? null : this.#revealAt(at);
  }

  #attach(): HTMLElement | null {
    if (this.#scroller?.contains(this.element)) return this.#scroller;
    this.#scroller?.removeEventListener('scroll', this.#onScroll);
    this.#resized.disconnect();
    this.#scroller = this.element.isConnected ? scrollerOf(this.element) : null;
    this.#scroller?.addEventListener('scroll', this.#onScroll, { passive: true });
    if (this.#scroller) this.#resized.observe(this.#scroller);
    return this.#scroller;
  }

  #view(scroller: HTMLElement): Viewport {
    const offset =
      scroller === this.element
        ? 0
        : this.element.getBoundingClientRect().top -
          scroller.getBoundingClientRect().top +
          scroller.scrollTop;
    return { scrollTop: scroller.scrollTop, height: scroller.clientHeight, offset };
  }

  /** The row with the keyboard is leaving the window: the list keeps the keyboard, and its place. */
  #hold(range: Range): void {
    const active = document.activeElement;
    if (!(active instanceof HTMLElement) || active === this.element) return;
    const row = active.closest<HTMLElement>('[data-window-key]');
    if (!row || !this.element.contains(row)) return;
    const at = this.#index.get(row.dataset.windowKey ?? '') ?? -1;
    if (at >= range.first && at < range.last) return;
    this.#held = row.dataset.windowKey ?? null;
    this.element.focus({ preventScroll: true });
  }

  /** The window's rows in place, moving and replacing as few as it can. */
  #place(range: Range): void {
    const wanted: HTMLElement[] = [];
    for (let at = range.first; at < range.last; at++) wanted.push(this.#element(at));
    const keep = new Set(wanted);
    for (const child of [...this.element.children]) {
      if (child !== this.#top && child !== this.#bottom && !keep.has(child as HTMLElement))
        child.remove();
    }
    let next: Element | null = this.#top.nextElementSibling;
    for (const row of wanted) {
      if (row === next) next = row.nextElementSibling;
      else this.element.insertBefore(row, next);
    }
  }

  #element(at: number): HTMLElement {
    const row = this.#rows[at] as WindowedRow;
    const kept = this.#made.get(row.key);
    const element = kept?.shows === row.shows ? kept.element : row.make();
    if (element !== kept?.element) {
      element.dataset.windowKey = row.key;
      this.#made.set(row.key, { shows: row.shows, element });
    }
    element.setAttribute('aria-setsize', String(this.#rows.length));
    element.setAttribute('aria-posinset', String(at + 1));
    return element;
  }

  #revealAt(at: number): HTMLElement {
    const scroller = this.#attach();
    if (scroller) {
      const height = this.#rowHeight || this.#estimate;
      scroller.scrollTop = revealTop(at, height, this.#view(scroller));
      this.render();
    }
    return this.#element(at);
  }

  #focusAt(at: number): void {
    const row = this.#revealAt(at);
    this.#held = null;
    (row.querySelector<HTMLElement>('button, [tabindex]') ?? row).focus();
  }

  /** ↑ ↓ Home End PageUp PageDown through every row, drawn or not. */
  #key(event: KeyboardEvent): void {
    if (!NAV_KEYS.has(event.key) || event.altKey || event.metaKey || event.ctrlKey) return;
    const target = event.target as HTMLElement;
    const key =
      target === this.element
        ? this.#held
        : target.closest<HTMLElement>('[data-window-key]')?.dataset.windowKey;
    const from = key === null || key === undefined ? -1 : (this.#index.get(key) ?? -1);
    if (from < 0 && target !== this.element) return;
    const last = this.#rows.length - 1;
    // A page is the rows that fit in the view, less one kept in sight.
    const view = this.#scroller?.clientHeight ?? 0;
    const page = Math.max(Math.floor(view / (this.#rowHeight || this.#estimate)) - 1, 1);
    const to = {
      ArrowUp: from - 1,
      ArrowDown: from + 1,
      Home: 0,
      End: last,
      PageUp: from - page,
      PageDown: from + page,
    }[event.key] as number;
    event.preventDefault();
    this.#focusAt(Math.min(Math.max(to, 0), last));
  }
}
