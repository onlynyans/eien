// A chapter in pages (#40, Phase 3b), and its place kept there. The chapter
// is laid in columns as tall as the whole lines its box holds, each column a
// page, the page in sight moved into the box. The place is Scroll's, an
// offset in the chapter's words (core/epub/place.ts): the page shown is the
// one holding it, and a turn keeps the new page's first word, so Pages and
// Scroll, a new width, face or zoom, ⇄ and a restart all come back to the
// same words. Laid out anew, the place isn't measured again (only a turn
// moves it), so a run of resizes never drifts. With room, two pages face each
// other (Phase 3d, ./spread.ts): a turn moves a sight, the pages shown at
// once; the first chapter begins with Eien's title page and imprint
// (./front-matter.ts), turned back to, never opened at.

import { openingSight, pageAt, pageRoles, throughSights } from '../../core/epub';
import { across, characterAt, firstOnPage, type SideOf } from './chapter-place';
import { FRONT } from './front-matter';
import {
  type Columns,
  clipAt,
  keyOf,
  layColumns,
  UNLAID,
  unlayColumns,
  zoomOf,
} from './page-columns';
import { sightCut } from './page-cut';
import { REST_MS } from './place-keeper';
import type { PageShown, Spot } from './sight';

export interface PagedPlaceOf {
  /** The box a page shows in: its size is a page's. */
  readonly box: HTMLElement;
  /** The chapter, drawn: laid in columns. */
  readonly chapter: HTMLElement;
  /** The pane the box lies in: wider or narrower, it may open a spread or close one. */
  readonly room?: HTMLElement;
  /** How many pages to show at once (./spread.ts), asked each time the page is laid out. */
  per?(): 1 | 2;
  /** A page turned or shown: how far through the chapter, 0 to 1. */
  moved(fraction: number): void;
  /** The place came to rest somewhere new: an offset in the chapter's words. */
  rested(offset: number): void;
  /** The page in sight, measured: from its first word to the next page's (Phase 4), as it's shown or turned. */
  inSight(from: number, to: number): void;
  readonly sideOf?: SideOf;
}

export class PagedPlace {
  readonly #of: PagedPlaceOf;
  readonly #sideOf: SideOf;
  #offset = 0;
  /** The sight shown (the pages in sight at once), 0 first. */
  #page = 0;
  /** The columns as last laid; none before the first. */
  #laid: Columns = UNLAID;
  /** A front page turned to: kept through a new layout (the place, offset 0, is the opening's). */
  #frontColumn: number | null = null;
  /** The pages in sight, as last measured. */
  #sight: readonly PageShown[] = [];
  #idle = true;
  #rest: ReturnType<typeof setTimeout> | undefined;
  readonly #resized: ResizeObserver | null;

  constructor(of: PagedPlaceOf) {
    this.#of = of;
    this.#sideOf = of.sideOf ?? across;
    this.#resized =
      typeof ResizeObserver === 'function' ? new ResizeObserver(() => this.#laidOut()) : null;
    this.#resized?.observe(of.box);
    if (of.room) this.#resized?.observe(of.room);
    of.chapter.addEventListener('focusin', this.#focused);
    document.fonts?.addEventListener?.('loadingdone', this.#again);
  }

  /** The place kept: an offset in the chapter's words. */
  get offset(): number {
    return this.#offset;
  }

  /** The sight shown, 0 first, and how many the chapter has. */
  get page(): number {
    return this.#page;
  }

  get pages(): number {
    return this.#laid.sights;
  }

  /** The chapter's own pages (its front matter left out), the first in sight, and how many show at once. */
  get columns(): { readonly at: number; readonly of: number; readonly per: 1 | 2 } {
    const { per, front, columns } = this.#laid;
    return { at: Math.max(0, this.#page * per - front), of: Math.max(1, columns - front), per };
  }

  /** The pages in sight: where each one's words begin, and what it is to the chapter. */
  get sight(): readonly PageShown[] {
    return this.#sight;
  }

  /** Where the page stands now, to `restore` (a turn that fell back). */
  get spot(): Spot {
    return {
      offset: this.#offset,
      page: this.#page,
      front: this.#frontColumn,
      key: this.#laid.key,
    };
  }

  /** A chapter drawn, or the page back where it was: `offset` kept, and its page shown. */
  show(offset: number): void {
    this.#idle = false;
    this.#offset = Math.max(0, offset);
    this.#frontColumn = null;
    this.reshow();
  }

  /** Put back at `spot`, as it stood (a turn that fell back): a front page stays a front page. */
  restore(spot: Spot): void {
    if (this.#idle) return;
    this.#offset = spot.offset;
    this.#frontColumn = spot.front;
    if (!this.#shown) return;
    // Laid out anew meanwhile (a pane past a spread, a zoom): the sight holding the place, found again.
    const { key, per } = this.#laid;
    if (spot.key === key) this.#go(spot.page);
    else this.#go(spot.front !== null ? Math.floor(spot.front / per) : this.#pageOf(spot.offset));
    this.#inSight(this.#range());
  }

  /** No chapter: nothing kept. */
  clear(): void {
    this.#flush(false);
    this.#idle = true;
    this.#offset = 0;
    this.#page = 0;
    this.#laid = UNLAID;
    this.#frontColumn = null;
    this.#sight = [];
    unlayColumns(this.#of.box, this.#of.chapter);
  }

  /** Laid out anew (a width, a look, put back in the window): the page holding the place shown. */
  reshow(): void {
    if (this.#idle) return;
    if (!this.#shown) {
      this.#laid = { ...this.#laid, key: '' };
      return;
    }
    this.#laid = layColumns(this.#of.box, this.#of.chapter, this.#of.per?.() ?? 1);
    const { per, front } = this.#laid;
    if (this.#frontColumn !== null && this.#frontColumn >= front) this.#frontColumn = null;
    this.#go(
      this.#frontColumn !== null ? Math.floor(this.#frontColumn / per) : this.#pageOf(this.#offset),
    );
    this.#inSight(this.#range());
  }

  /**
   * The page `way` on in this chapter, its first word kept as the place; false
   * past either end (the next chapter's, or the one before's).
   */
  turn(way: 1 | -1): boolean {
    const page = this.#page + way;
    if (this.#idle || page < 0 || page >= this.#laid.sights) return false;
    this.#turnTo(page);
    return true;
  }

  /** The chapter's first page (its opening, past any front matter), or its last (Home, End). */
  edge(last: boolean): void {
    if (this.#idle) return;
    const { sights, front, per } = this.#laid;
    this.#turnTo(last ? sights - 1 : openingSight(front, per));
  }

  /**
   * The page holding `element` (a link the keyboard came to on another page),
   * turned to at once: what has the keyboard is always in sight.
   */
  reveal(element: Element): void {
    if (this.#idle || !this.#shown) return;
    // A link that wraps from the page before is on this page too: it's in sight already.
    const box = this.#of.box.getBoundingClientRect();
    const inSight = [...element.getClientRects()].some(
      (rect) => rect.right > box.left && rect.left < box.left + box.width,
    );
    if (inSight) return;
    const range = document.createRange();
    range.selectNodeContents(element);
    const from = this.#sideOf(range).left - this.#of.chapter.getBoundingClientRect().left;
    const page = pageAt(from / this.#scale(), this.#laid.step, this.#laid.sights);
    if (page !== this.#page) this.#turnTo(page);
  }

  /** A turn's place on its way to rest, told now (the page closing, the window quitting, ⇄). */
  keep(): void {
    this.#flush(true);
  }

  dispose(): void {
    this.keep();
    this.#resized?.disconnect();
    this.#of.chapter.removeEventListener('focusin', this.#focused);
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

  /** The sight holding `offset`, by where its character stands from the chapter's start; 0 is the opening. */
  #pageOf(offset: number): number {
    const character = offset > 0 ? characterAt(this.#of.chapter, offset) : null;
    if (!character) return openingSight(this.#laid.front, this.#laid.per);
    const from = this.#sideOf(character).left - this.#of.chapter.getBoundingClientRect().left;
    return pageAt(from / this.#scale(), this.#laid.step, this.#laid.sights);
  }

  /** Turned to `page`: its first word the place, told once the turns rest. */
  #turnTo(page: number): void {
    this.#go(page);
    const range = this.#range();
    this.#offset = range.from;
    const first = this.#page * this.#laid.per;
    this.#frontColumn = first < this.#laid.front ? first : null;
    clearTimeout(this.#rest);
    this.#rest = setTimeout(() => this.#flush(true), REST_MS);
    this.#inSight(range);
  }

  /**
   * The page in sight's words: from its first (0 on the first page) to the
   * next page's first, null on the last. A turn's copy is cut to them, and
   * they're the page a bookmark marks.
   */
  #range(): { readonly from: number; readonly to: number | null } {
    const { chapter, box } = this.#of;
    // The front matter holds none of the book's words: nothing in sight to keep, mark or say.
    if (this.#onFront) return { from: 0, to: 0 };
    const left = box.getBoundingClientRect().left;
    // The page starts just after the page before's last word, so a picture that begins it (or is
    // all of it) comes with it.
    const from = this.#page > 0 ? firstOnPage(chapter, left, this.#sideOf) : 0;
    const to =
      this.#page + 1 < this.#laid.sights
        ? firstOnPage(chapter, left + this.#laid.step * this.#scale(), this.#sideOf)
        : null;
    return { from, to };
  }

  #inSight({ from, to }: { readonly from: number; readonly to: number | null }): void {
    const end = to ?? Number.POSITIVE_INFINITY;
    const left = this.#of.box.getBoundingClientRect().left;
    const { per, front, columns, column, gap } = this.#laid;
    // A spread's recto begins where its own words do: one more measure a turn.
    this.#sight = pageRoles(this.#page, per, front, columns).map((role, i) => {
      if (i === 0 || role === 'front') return { role, from };
      if (role === 'blank') return { role, from: end };
      const at = left + i * (column + gap) * this.#scale();
      return { role, from: firstOnPage(this.#of.chapter, at, this.#sideOf) };
    });
    this.#of.inSight(from, end);
  }

  /**
   * `copy`, a copy of the chapter as it stands (a turn's, ./turn/page-copy.ts),
   * cut to the words in sight and laid as its first sight: a turn moves one
   * sight, never the whole chapter (fourteen copies of a long one would stall
   * the window). A front page's copy is the front matter alone, where it stood.
   */
  trim(copy: HTMLElement): void {
    if (this.#idle || !this.#shown) return;
    const { chapter } = this.#of;
    const at = this.#onFront ? this.#page * this.#laid.step : 0;
    const { from, to } = this.#range();
    copy.replaceChildren(
      this.#onFront
        ? (chapter.querySelector(FRONT)?.cloneNode(true) ?? '')
        : sightCut(chapter, from, to),
    );
    copy.style.transform = at ? `translateX(${-at}px)` : '';
    copy.style.clipPath = clipAt(at, this.#laid.gap);
  }

  /** Whether the sight shown is Eien's front matter: none of the book's words in it. */
  get #onFront(): boolean {
    return this.#page * this.#laid.per < this.#laid.front;
  }

  #go(page: number): void {
    const { sights, step, front, per } = this.#laid;
    this.#page = Math.min(Math.max(0, page), sights - 1);
    const at = this.#page * step;
    const { style } = this.#of.chapter;
    style.transform = `translateX(${-at}px)`;
    // Only the page in sight is drawn: a copy of the chapter carries this page alone.
    style.clipPath = clipAt(at, this.#laid.gap);
    this.#of.moved(throughSights(this.#page, sights, openingSight(front, per)));
  }

  /** How much the sheet's zoom draws each of the box's pixels as: rects are zoomed, sizes aren't. */
  #scale(): number {
    return zoomOf(this.#of.box);
  }

  readonly #again = () => this.reshow();

  readonly #focused = (event: FocusEvent) => {
    if (event.target instanceof Element) this.reveal(event.target);
  };

  #laidOut(): void {
    const { box } = this.#of;
    // Asked first: a pane that opens a spread or closes one lays the page out anew, its box still as it was.
    const now = keyOf(box, this.#of.per?.() ?? 1);
    if (now === '') this.#laid = { ...this.#laid, key: '' };
    else if (now !== this.#laid.key) this.reshow();
  }
}
