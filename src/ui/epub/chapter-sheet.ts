// The chapter on a book's sheet (#40, Phase 2): what the page does with the
// words it holds, apart from its frame (./epub-page.ts). The chapter drawn
// with the chapters either side at its foot (./chapter-foot.ts); its place
// kept as it scrolls (./place-keeper.ts) and shown again; its links caught
// (./book-links.ts) and the places they name found; its words copied alone
// (./book-words.ts) and chosen for a quote (./book-selection.ts).

import type { ZipAddress } from '../../core/epub';
import { h } from '../dom';
import { catchLinks, markerIn } from './book-links';
import { BookSelection } from './book-selection';
import { copyWords } from './book-words';
import { offsetAfter } from './chapter-place';
import { PlaceKeeper } from './place-keeper';

export interface ChapterSheetOf {
  /** The page's scroller, which the chapter scrolls in. */
  readonly scroller: HTMLElement;
  /** As it scrolls: how far through the chapter (0 to 1). */
  moved(fraction: number): void;
  /** Its place came to rest somewhere new: an offset in the chapter's words. */
  rested(offset: number): void;
  /** One of the book's own links pressed. */
  follow(anchor: HTMLAnchorElement, link: ZipAddress): void;
  /** Quote the words chosen in it in the note beside (Phase 2c). */
  quote(): void;
}

export class ChapterSheet {
  /** The chapter, drawn: the book's stylesheet (./epub.css) styles what's in it. */
  readonly element = h('div', { class: 'epub-chapter' });
  /** Its foot: the chapters either side. */
  readonly turns = h('div', { class: 'epub__turns' });
  readonly #keeper: PlaceKeeper;
  readonly #selection: BookSelection;
  readonly #stopCopy: () => void;

  constructor(of: ChapterSheetOf) {
    catchLinks(this.element, (anchor, link) => of.follow(anchor, link));
    this.#stopCopy = copyWords(this.element);
    this.#selection = new BookSelection({
      chapter: this.element,
      scroller: of.scroller,
      quote: () => of.quote(),
    });
    this.#keeper = new PlaceKeeper({
      scroller: of.scroller,
      chapter: this.element,
      moved: (fraction) => of.moved(fraction),
      rested: (offset) => of.rested(offset),
    });
  }

  /** `chapter` in place of the last, with its `foot`, its place `offset` kept and shown. */
  drawn(chapter: DocumentFragment, foot: HTMLElement, offset: number): void {
    this.element.replaceChildren(chapter);
    this.turns.replaceChildren(foot);
    this.#keeper.show(offset);
  }

  /** No chapter: nothing kept of one. */
  clear(): void {
    this.#keeper.clear();
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

  /** The words chosen in the chapter (or last chosen there, while it's drawn); null for none. */
  get selection(): Range | null {
    return this.#selection.range;
  }

  dispose(): void {
    this.#keeper.dispose();
    this.#stopCopy();
    this.#selection.remove();
  }
}
