// The chapter on a book's sheet (#40, Phase 2): what the page does with the
// words it holds, apart from its frame (./epub-page.ts). The chapter drawn
// with the chapters either side at its foot (./chapter-foot.ts); its place
// kept as it scrolls (./place-keeper.ts) or in pages (./paged-place.ts,
// Phase 3b), the same offset either way, and shown again; its links caught
// (./book-links.ts) and the places they name found; its words copied alone
// (./book-words.ts) and chosen for a quote (./book-selection.ts).

import type { ZipAddress } from '../../core/epub';
import { h } from '../dom';
import { catchLinks, markerIn } from './book-links';
import { BookSelection } from './book-selection';
import { copyWords } from './book-words';
import { offsetAfter } from './chapter-place';
import { PagedPlace } from './paged-place';
import { PlaceKeeper } from './place-keeper';
import type { PageShown, Spot } from './sight';
import { type PagesChoice, spreadOf } from './spread';

export interface ChapterSheetOf {
  /** The page's scroller, which the chapter scrolls in. */
  readonly scroller: HTMLElement;
  /** As it scrolls or turns: how far through the chapter (0 to 1). */
  moved(fraction: number): void;
  /** Its place came to rest somewhere new: an offset in the chapter's words. */
  rested(offset: number): void;
  /** The words in sight, measured (Phase 4): the page in pages, the lines in sight scrolling. */
  inSight(from: number, to: number): void;
  /** One of the book's own links pressed. */
  follow(anchor: HTMLAnchorElement, link: ZipAddress): void;
  /** Quote the words chosen in it in the note beside (Phase 2c). */
  quote(): void;
  /** Highlight the words chosen in it, or take off the highlight they lie in (Phase 5a). */
  highlight(): void;
  /** Whether `range`'s words lie in one highlight: the bar's Highlight then takes it off. */
  inHighlight(range: Range): boolean;
  /** A turn's copy of the chapter, cut to the page in sight whose first word is `from`: inked as the page is. */
  copied(copy: HTMLElement, from: number): void;
  /** In pages, one page, two, or as the width allows (./spread.ts). */
  pages?(): PagesChoice;
}

export class ChapterSheet {
  /** The chapter, drawn: the book's stylesheet (./epub.css) styles what's in it. */
  readonly element = h('div', { class: 'epub-chapter' });
  /** The box a page shows in, in pages: the chapter inside it. */
  readonly box = h('div', { class: 'epub__pages' }, this.element);
  /** Its foot: the chapters either side. */
  readonly turns = h('div', { class: 'epub__turns' });
  readonly #scrolled: PlaceKeeper;
  readonly #paged: PagedPlace;
  #keeper: PlaceKeeper | PagedPlace;
  #drawn = false;
  readonly #selection: BookSelection;
  readonly #stopCopy: () => void;
  readonly #copied: ChapterSheetOf['copied'];

  constructor(of: ChapterSheetOf) {
    this.#copied = (copy, from) => of.copied(copy, from);
    catchLinks(this.element, (anchor, link) => of.follow(anchor, link));
    this.#stopCopy = copyWords(this.element);
    this.#selection = new BookSelection({
      chapter: this.element,
      scroller: of.scroller,
      quote: () => of.quote(),
      highlight: () => of.highlight(),
      inHighlight: (range) => of.inHighlight(range),
    });
    const told = {
      chapter: this.element,
      moved: (fraction: number) => of.moved(fraction),
      rested: (offset: number) => of.rested(offset),
      inSight: (from: number, to: number) => of.inSight(from, to),
    };
    this.#scrolled = new PlaceKeeper({ ...told, scroller: of.scroller });
    this.#paged = new PagedPlace({
      ...told,
      box: this.box,
      room: of.scroller,
      per: () => spreadOf(this.box, this.element, of.scroller, of.pages?.()),
    });
    this.#keeper = this.#scrolled;
  }

  /** Whether the chapter is in pages, or scrolls. */
  get paged(): boolean {
    return this.#keeper === this.#paged;
  }

  /**
   * In pages, or scrolling: the place carried across, the other let go. The
   * place is the caller's to keep first (`keep`), while the old layout stands:
   * measured once the new one is worn, it would read the wrong words.
   */
  set paged(paged: boolean) {
    const next = paged ? this.#paged : this.#scrolled;
    if (next === this.#keeper) return;
    const offset = this.#keeper.offset;
    this.#keeper.clear();
    this.#keeper = next;
    if (this.#drawn) next.show(offset);
  }

  /** In pages: the page `way` on in this chapter, kept as the place; false past either end. */
  turn(way: 1 | -1): boolean {
    if (!this.paged || !this.#paged.turn(way)) return false;
    this.#unchoose();
    return true;
  }

  /** Words chosen on a page turned away from: out of sight, so not to be quoted, and their bar gone. */
  #unchoose(): void {
    if (this.#selection.range) document.getSelection()?.removeAllRanges();
    this.#selection.forget();
  }

  /** In pages: a copy of the chapter cut to the page in sight (a turn's), inked as the page is. */
  trim(copy: HTMLElement): void {
    if (!this.paged) return;
    // Inked from where the cut begins, not the place kept, which may stand mid-page; a copy of
    // Eien's front matter holds none of the book's words.
    const from = this.#paged.trim(copy);
    if (from !== null) this.#copied(copy, from);
  }

  /** In pages: the chapter's first page, or its last. */
  edge(last: boolean): void {
    if (!this.paged) return;
    this.#paged.edge(last);
    this.#unchoose();
  }

  /**
   * In pages: the chapter's own pages (its front matter left out), the first
   * in sight (0 first), how many it has, and how many show at once.
   */
  get page(): { readonly at: number; readonly of: number; readonly per: 1 | 2 } {
    return this.#paged.columns;
  }

  /** In pages, the pages in sight (one, or a spread's two): where each one's words begin, and its part. */
  get sight(): readonly PageShown[] {
    return this.paged ? this.#paged.sight : [];
  }

  /** In pages, where the page stands now, to put back exactly (a turn that fell back). */
  get spot(): Spot {
    return this.#paged.spot;
  }

  restore(spot: Spot): void {
    if (this.paged) this.#paged.restore(spot);
  }

  /** `chapter` in place of the last, with its `foot`, its place `offset` kept and shown. */
  drawn(chapter: DocumentFragment, foot: HTMLElement, offset: number): void {
    this.#selection.forget();
    this.element.replaceChildren(chapter);
    this.turns.replaceChildren(foot);
    this.#drawn = true;
    this.#keeper.show(offset);
  }

  /** No chapter: nothing kept of one. */
  clear(): void {
    this.#selection.forget();
    this.#keeper.clear();
    this.#drawn = false;
    this.element.replaceChildren();
    this.turns.replaceChildren();
  }

  /** The place kept in the chapter: an offset in its words, as last measured at rest. */
  get place(): number {
    return this.#keeper.offset;
  }

  /** The chapter shown with the line holding `offset` at its top, and that kept as its place. */
  showPlace(offset: number): void {
    this.#keeper.show(offset);
  }

  /** A place on its way to rest, kept now (the page closing, about to be taken out, the window quitting). */
  keep(): void {
    this.#keeper.keep();
  }

  /** Laid out anew (put back in the pane, a new look): the place shown again. */
  reshow(): void {
    this.#keeper.reshow();
  }

  /** The offset of the place `name` in the chapter: where a link to it goes; null for none. */
  offsetOf(name: string): number | null {
    const marker = markerIn(this.element, name);
    return marker ? offsetAfter(this.element, marker) : null;
  }

  /** The words chosen in the chapter now; null for none. */
  get selection(): Range | null {
    return this.#selection.range;
  }

  /** The words chosen now, or else last chosen in this chapter: what a phone's ⋯ quotes, after its tap. */
  get kept(): Range | null {
    return this.#selection.kept;
  }

  dispose(): void {
    this.#scrolled.dispose();
    this.#paged.dispose();
    this.#stopCopy();
    this.#selection.remove();
  }
}
