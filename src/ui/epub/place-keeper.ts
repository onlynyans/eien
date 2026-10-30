// A book's place kept as its page scrolls (#40, Phase 2): how far through
// the chapter, told each frame for the colophon, and the first line in
// sight (./chapter-place.ts), measured once the scroll comes to rest. The
// place is kept here as last measured, never measured while the page is out
// of sight (a phone's page gone back to the list has no layout, and would
// read the chapter's top): closing, quitting and ⇄ read what's kept. And
// whenever the chapter is laid out anew (a new width, look or face, its
// fonts arriving, the page put back in the window or in sight again), it's
// shown at the same line. Eien's own scrolls (showing the place) are never
// taken for the reader's.

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
  /**
   * The words in sight, measured: from the place to the first line under the
   * page's foot (Phase 4), as the place is shown, laid out anew or rests.
   */
  placed(from: number, to: number): void;
  readonly rectOf?: RectOf;
}

export class PlaceKeeper {
  readonly #of: PlaceKeeperOf;
  #offset = 0;
  #rest: ReturnType<typeof setTimeout> | undefined;
  #frame = 0;
  /** No chapter to keep a place in (none drawn, or refused): scrolls tell nothing. */
  #idle = true;
  /** The scroll Eien just set, this frame: its scroll event isn't the reader's. */
  #own: number | null = null;
  /** The chapter's box as drawn (zoom included) when last shown; none once out of sight, so coming back shows it again. */
  #box = '';
  /** Where the scroll stood when the place was last shown or measured: elsewhere, the reader moved it. */
  #top = 0;
  readonly #resized: ResizeObserver | null;

  constructor(of: PlaceKeeperOf) {
    this.#of = of;
    of.scroller.addEventListener('scroll', this.#scrolled, { passive: true });
    this.#resized =
      typeof ResizeObserver === 'function' ? new ResizeObserver(() => this.#laidOut()) : null;
    this.#resized?.observe(of.chapter);
    document.fonts?.addEventListener?.('loadingdone', this.#again);
  }

  /** The place kept: an offset in the chapter's words. */
  get offset(): number {
    return this.#offset;
  }

  /** Whether the page has a layout to measure: in the window, and in sight. */
  get #shown(): boolean {
    return this.#of.scroller.isConnected && this.#of.scroller.clientHeight > 0;
  }

  /** A chapter drawn, or the page back where it was: `offset` kept, and shown once it can be. */
  show(offset: number): void {
    this.#stopRest();
    this.#idle = false;
    this.#offset = Math.max(0, offset);
    this.#reshow();
  }

  /** No chapter on the page: nothing to keep, and nothing said of a scroll. */
  clear(): void {
    this.#stopRest();
    cancelAnimationFrame(this.#frame);
    this.#idle = true;
    this.#offset = 0;
  }

  /**
   * A rest on its way, taken now: measured if the page is in sight, and told
   * if it moved. Also a scroll whose event hasn't come yet: the scroll stands
   * elsewhere than it was left.
   */
  keep(): void {
    const { scroller, chapter, rectOf } = this.#of;
    if (this.#rest === undefined && scroller.scrollTop === this.#top) return;
    this.#stopRest();
    if (!this.#shown || this.#idle) return;
    this.#top = scroller.scrollTop;
    const offset = firstInSight(chapter, scroller.getBoundingClientRect().top, rectOf);
    const moved = offset !== this.#offset;
    this.#offset = offset;
    this.#placed();
    if (moved) this.#of.rested(offset);
  }

  /** The lines in sight told: from the place to the first one the page's foot cuts or hides. */
  #placed(): void {
    const { scroller, chapter, rectOf } = this.#of;
    const to = firstInSight(chapter, scroller.getBoundingClientRect().bottom, rectOf);
    this.#of.placed(this.#offset, Math.max(this.#offset, to));
  }

  /**
   * Put back in the window (its scroll begun again at the top), or laid out
   * anew: the place shown again. A rest on its way is the caller's to keep
   * first, while the old layout stands (`keep`).
   */
  reshow(): void {
    this.#stopRest();
    this.#reshow();
  }

  dispose(): void {
    this.keep();
    this.#of.scroller.removeEventListener('scroll', this.#scrolled);
    this.#resized?.disconnect();
    document.fonts?.removeEventListener?.('loadingdone', this.#again);
    cancelAnimationFrame(this.#frame);
  }

  #stopRest(): void {
    clearTimeout(this.#rest);
    this.#rest = undefined;
  }

  #reshow(): void {
    if (this.#idle) return;
    if (!this.#shown) {
      this.#box = '';
      return;
    }
    const { scroller, chapter, rectOf } = this.#of;
    this.#box = this.#boxNow();
    showOffset(chapter, scroller, this.#offset, rectOf);
    this.#own = this.#top = scroller.scrollTop;
    requestAnimationFrame(() => {
      this.#own = null;
    });
    this.#tell();
    this.#placed();
  }

  readonly #scrolled = () => {
    if (this.#idle) return;
    cancelAnimationFrame(this.#frame);
    this.#frame = requestAnimationFrame(() => this.#tell());
    if (this.#own !== null && this.#of.scroller.scrollTop === this.#own) return;
    this.#stopRest();
    this.#rest = setTimeout(() => this.keep(), REST_MS);
  };

  #tell(): void {
    const { scrollTop, scrollHeight, clientHeight } = this.#of.scroller;
    this.#of.moved(chapterFraction(scrollTop, scrollHeight, clientHeight));
  }

  /** Laid out anew while the reader isn't scrolling: shown again at the line. */
  readonly #again = () => {
    if (this.#rest === undefined) this.#reshow();
  };

  /** The chapter's box as drawn: its lines move when it changes (a width, a look, the page's zoom). */
  #boxNow(): string {
    const { width, height } = this.#of.chapter.getBoundingClientRect();
    return width === 0 ? '' : `${width}×${height}`;
  }

  /** The chapter's box changed: out of sight, it's shown again on coming back; laid out anew, now. */
  #laidOut(): void {
    const box = this.#boxNow();
    if (box === '') this.#box = '';
    else if (box !== this.#box) this.#again();
  }
}
