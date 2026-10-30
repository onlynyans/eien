// A chapter in pages (#40, Phase 3b), and its place kept there. The chapter
// is laid in columns as tall as the whole lines its box holds, each column a
// page, the page in sight moved into the box. The place is Scroll's, an
// offset in the chapter's words (core/epub/place.ts): the page shown is the
// one holding it, and a turn keeps the new page's first word, so Pages and
// Scroll, a new width, face or zoom, ⇄ and a restart all come back to the
// same words. Laid out anew, the place isn't measured again (only a turn
// moves it), so a run of resizes never drifts.

import { pageAt, pagesIn, wholeLines } from '../../core/epub';
import { characterAt, firstOnPage, type SideOf } from './chapter-place';
import { REST_MS } from './place-keeper';

export interface PagedPlaceOf {
  /** The box a page shows in: its size is a page's. */
  readonly box: HTMLElement;
  /** The chapter, drawn: laid in columns. */
  readonly chapter: HTMLElement;
  /** A page turned or shown: how far through the chapter, 0 to 1. */
  moved(fraction: number): void;
  /** The place came to rest somewhere new: an offset in the chapter's words. */
  rested(offset: number): void;
  readonly sideOf?: SideOf;
}

const measured: SideOf = (range) => range.getBoundingClientRect();

export class PagedPlace {
  readonly #of: PagedPlaceOf;
  readonly #sideOf: SideOf;
  #offset = 0;
  #page = 0;
  #pages = 1;
  /** A page's width and the gap after it, in the chapter's own pixels. */
  #step = 0;
  #gap = 0;
  #idle = true;
  #rest: ReturnType<typeof setTimeout> | undefined;
  /** The box as last laid out: laid out anew when it changes. */
  #box = '';
  readonly #resized: ResizeObserver | null;

  constructor(of: PagedPlaceOf) {
    this.#of = of;
    this.#sideOf = of.sideOf ?? measured;
    this.#resized =
      typeof ResizeObserver === 'function' ? new ResizeObserver(() => this.#laidOut()) : null;
    this.#resized?.observe(of.box);
    document.fonts?.addEventListener?.('loadingdone', this.#again);
  }

  /** The place kept: an offset in the chapter's words. */
  get offset(): number {
    return this.#offset;
  }

  /** The page in sight, 0 first, and how many the chapter has. */
  get page(): number {
    return this.#page;
  }

  get pages(): number {
    return this.#pages;
  }

  /** A chapter drawn, or the page back where it was: `offset` kept, and its page shown. */
  show(offset: number): void {
    this.#idle = false;
    this.#offset = Math.max(0, offset);
    this.reshow();
  }

  /** No chapter: nothing kept. */
  clear(): void {
    this.#flush(false);
    this.#idle = true;
    this.#offset = 0;
    this.#page = 0;
    this.#pages = 1;
    const { style } = this.#of.chapter;
    for (const name of [
      'height',
      'width',
      'columnWidth',
      'columnGap',
      'transform',
      'clipPath',
    ] as const) {
      style[name] = '';
    }
    style.removeProperty('--epub-page-height');
  }

  /** Laid out anew (a width, a look, put back in the window): the page holding the place shown. */
  reshow(): void {
    if (this.#idle) return;
    if (!this.#shown) {
      this.#box = '';
      return;
    }
    this.#layout();
    this.#go(this.#pageOf(this.#offset));
  }

  /**
   * The page `way` on in this chapter, its first word kept as the place; false
   * past either end (the next chapter's, or the one before's).
   */
  turn(way: 1 | -1): boolean {
    const page = this.#page + way;
    if (this.#idle || page < 0 || page >= this.#pages) return false;
    this.#turnTo(page);
    return true;
  }

  /** The chapter's first page, or its last (Home, End). */
  edge(last: boolean): void {
    if (!this.#idle) this.#turnTo(last ? this.#pages - 1 : 0);
  }

  /** A turn's place on its way to rest, told now (the page closing, the window quitting, ⇄). */
  keep(): void {
    this.#flush(true);
  }

  dispose(): void {
    this.keep();
    this.#resized?.disconnect();
    document.fonts?.removeEventListener?.('loadingdone', this.#again);
  }

  get #shown(): boolean {
    return this.#of.box.isConnected && this.#of.box.clientWidth > 0;
  }

  #flush(tell: boolean): void {
    if (this.#rest === undefined) return;
    clearTimeout(this.#rest);
    this.#rest = undefined;
    if (tell) this.#of.rested(this.#offset);
  }

  /** The columns laid to the box: whole lines tall, the gap between, the pages counted. */
  #layout(): void {
    const { box, chapter } = this.#of;
    const width = box.clientWidth;
    const line = Number.parseFloat(getComputedStyle(chapter).lineHeight) || 0;
    // The gap a column leaves before the next: the box's own padding-free gutter (epub.css).
    const gap = Number.parseFloat(getComputedStyle(box).columnGap) || 0;
    const height = wholeLines(box.clientHeight, line);
    // A picture's most, its page's height (./epub.css).
    chapter.style.setProperty('--epub-page-height', `${height}px`);
    Object.assign(chapter.style, {
      height: `${height}px`,
      width: `${width}px`,
      columnWidth: `${width}px`,
      columnGap: `${gap}px`,
    });
    this.#box = `${width}×${box.clientHeight}`;
    this.#step = width + gap;
    this.#gap = gap;
    this.#pages = pagesIn(chapter.scrollWidth, width, gap);
  }

  /** The page holding `offset`, by where its character stands from the chapter's start. */
  #pageOf(offset: number): number {
    const character = offset > 0 ? characterAt(this.#of.chapter, offset) : null;
    if (!character) return 0;
    const from = this.#sideOf(character).left - this.#of.chapter.getBoundingClientRect().left;
    return pageAt(from / this.#scale(), this.#step, this.#pages);
  }

  /** Turned to `page`: its first word the place, told once the turns rest. */
  #turnTo(page: number): void {
    this.#go(page);
    this.#offset = firstOnPage(
      this.#of.chapter,
      this.#of.box.getBoundingClientRect().left,
      this.#sideOf,
    );
    clearTimeout(this.#rest);
    this.#rest = setTimeout(() => this.#flush(true), REST_MS);
  }

  #go(page: number): void {
    this.#page = Math.min(Math.max(0, page), this.#pages - 1);
    const at = this.#page * this.#step;
    const { style } = this.#of.chapter;
    style.transform = `translateX(${-at}px)`;
    // Only the page in sight is drawn, and half the gap either side for a letter's overhang: a copy
    // of the chapter (a turn's, ./turn/page-copy.ts) carries this page alone, never its neighbours.
    const half = this.#gap / 2;
    style.clipPath = `inset(0px ${-(at + half)}px 0px ${at - half}px)`;
    this.#of.moved(this.#pages > 1 ? this.#page / (this.#pages - 1) : 1);
  }

  /** How much the sheet's zoom draws each of the box's pixels as: rects are zoomed, sizes aren't. */
  #scale(): number {
    const { box } = this.#of;
    return box.clientWidth > 0 ? box.getBoundingClientRect().width / box.clientWidth || 1 : 1;
  }

  readonly #again = () => this.reshow();

  #laidOut(): void {
    const { box } = this.#of;
    const now = box.clientWidth > 0 ? `${box.clientWidth}×${box.clientHeight}` : '';
    if (now === '') this.#box = '';
    else if (now !== this.#box) this.reshow();
  }
}
