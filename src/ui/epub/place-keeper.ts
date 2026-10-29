// A book's place kept as its page scrolls (#40, Phase 2): how far through
// the chapter, told each frame for the colophon, and the first line in
// sight (./chapter-place.ts), measured once the scroll comes to rest. The
// place is kept here as last measured, never measured while the page is out
// of sight (a phone's page gone back to the list has no layout, and would
// read the chapter's top): closing, quitting and ⇄ read what's kept. And
// when the chapter is laid out again (a new width, size or face; the page
// put back in the window), it's shown at the same line.

import { chapterFraction } from '../../core/epub';
import { firstInSight, type RectOf, showOffset } from './chapter-place';

/** How long the scroll is still before the place is measured, and kept. */
export const REST_MS = 1000;

export interface PlaceKeeperOf {
  readonly scroller: HTMLElement;
  readonly chapter: HTMLElement;
  /** As the page scrolls, in a frame: how far through the chapter, 0 to 1. */
  moved(fraction: number): void;
  /** The place came to rest somewhere new: an offset in the chapter's words. */
  rested(offset: number): void;
  readonly rectOf?: RectOf;
}

export class PlaceKeeper {
  readonly #of: PlaceKeeperOf;
  #offset = 0;
  #rest: ReturnType<typeof setTimeout> | undefined;
  #frame = 0;
  /** The chapter's width when last laid out: another means its lines moved. */
  #width = 0;
  readonly #resized: ResizeObserver | null;

  constructor(of: PlaceKeeperOf) {
    this.#of = of;
    of.scroller.addEventListener('scroll', this.#scrolled, { passive: true });
    this.#resized =
      typeof ResizeObserver === 'function' ? new ResizeObserver(() => this.#laidOut()) : null;
    this.#resized?.observe(of.chapter);
  }

  /** The place kept: an offset in the chapter's words. */
  get offset(): number {
    return this.#offset;
  }

  /** Whether the page has a layout to measure: in the window, and in sight. */
  get #shown(): boolean {
    return this.#of.scroller.isConnected && this.#of.scroller.clientHeight > 0;
  }

  /** A chapter just drawn, or the page put back: show `offset`, and keep it. */
  show(offset: number): void {
    clearTimeout(this.#rest);
    this.#offset = Math.max(0, offset);
    this.#reshow();
  }

  /** A rest on its way, taken now: measured if the page is in sight, and told if it moved. */
  keep(): void {
    if (this.#rest === undefined) return;
    clearTimeout(this.#rest);
    this.#rest = undefined;
    if (!this.#shown) return;
    const { scroller, chapter, rectOf } = this.#of;
    const offset = firstInSight(chapter, scroller.getBoundingClientRect().top, rectOf);
    if (offset === this.#offset) return;
    this.#offset = offset;
    this.#of.rested(offset);
  }

  /** The page put back in the window, the same size: its scroll began again at the top. */
  placed(): void {
    if (this.#rest === undefined) this.#reshow();
  }

  dispose(): void {
    this.keep();
    this.#of.scroller.removeEventListener('scroll', this.#scrolled);
    this.#resized?.disconnect();
    cancelAnimationFrame(this.#frame);
  }

  #reshow(): void {
    if (!this.#shown) return;
    const { scroller, chapter, rectOf } = this.#of;
    this.#width = chapter.clientWidth;
    showOffset(chapter, scroller, this.#offset, rectOf);
    // Kept as it's measured (the line's first word), so the rest after this scroll finds it unmoved.
    if (this.#offset > 0) {
      this.#offset = firstInSight(chapter, scroller.getBoundingClientRect().top, rectOf);
    }
    this.#tell();
  }

  readonly #scrolled = () => {
    cancelAnimationFrame(this.#frame);
    this.#frame = requestAnimationFrame(() => this.#tell());
    clearTimeout(this.#rest);
    this.#rest = setTimeout(() => this.keep(), REST_MS);
  };

  #tell(): void {
    const { scrollTop, scrollHeight, clientHeight } = this.#of.scroller;
    this.#of.moved(chapterFraction(scrollTop, scrollHeight, clientHeight));
  }

  /** The chapter laid out anew: at another width its lines moved, so the place is shown again. */
  #laidOut(): void {
    const width = this.#of.chapter.clientWidth;
    if (width === 0 || width === this.#width || this.#rest !== undefined) return;
    this.#reshow();
  }
}
