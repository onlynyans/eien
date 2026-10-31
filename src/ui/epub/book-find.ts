// Find in a book (#40, Phase 5c; the owner's answer, 2026-10-31: ⌘F opens
// the page's own find bar, as on a note): what the window's find bar
// (../find/find-bar.ts) searches over a book's page, the whole book in the
// background (./book-search.ts), never Replace. Every match in the chapter
// drawn is inked in the chosen row's wash, the one Find is on in the
// selection's (./ink.ts): painted, not chosen, while the bar has the
// keyboard, as a choice in the page would take its typing; chosen as the
// bar closes, so the words are the page's selection to quote or highlight,
// as a note's Find leaves its match chosen.

import { type Epub, type FindOptions, type Found, matcherOf, walkPlaces } from '../../core/epub';
import type { FindCount } from '../../core/find';
import { FindBar } from '../find/find-bar';
import type { FindQuery, FindTarget } from '../find/find-target';
import type { Still } from './book-count';
import type { BookSearch } from './book-search';
import { boundsOf, rangeOver, walked } from './chapter-range';
import type { EpubPage } from './epub-page';
import { Ink, inkCopy } from './ink';

export interface BookFindOf {
  readonly page: EpubPage;
  /** A search of the page's own over the window's chapters read (./book-search.ts). */
  readonly search: (changed: () => void) => BookSearch;
  epub(): Epub | null;
  /** The spine item drawn; -1 for none. */
  spine(): number;
  /** `then` once no page turns. */
  still: Still;
  /** Show spine item `index` at an offset in its words, once drawn. */
  goTo(index: number, offset: number): Promise<void>;
}

/** Where a match is, for the walk between them: its chapter, and its first word. */
const placeOf = (match: Found) => ({ spine: match.spine, offset: match.from });

/** The find bar's options as a book's matcher takes them. */
const optionsOf = (query: FindQuery): FindOptions => ({
  caseSensitive: query.caseSensitive,
  wholeWord: query.wholeWord,
  regexp: query.regexp,
});

export class BookFind implements FindTarget {
  readonly bar: FindBar;
  readonly #of: BookFindOf;
  readonly #search: BookSearch;
  readonly #found = new Ink('epub-found');
  readonly #current = new Ink('epub-found-current');
  #open = false;
  #invalid = false;
  /** The match Find is on, by its place among them; -1 for none yet. */
  #at = -1;
  /** A letter typed: once a match at or past the place is found, Find goes to it. */
  #narrowing = false;

  constructor(of: BookFindOf) {
    this.#of = of;
    this.#search = of.search(() => this.#changed());
    this.bar = new FindBar(this, 'Find in the book');
    of.page.element.append(this.bar.element);
  }

  open(): void {
    this.#open = true;
    this.bar.shown(true);
    this.paint();
  }

  close(): boolean {
    if (!this.#open) return false;
    this.#open = false;
    this.#search.stop();
    this.bar.shown(false);
    this.#found.clear();
    this.#current.clear();
    // The match it was on chosen in the page, the keyboard back on it.
    const match = this.#search.found[this.#at];
    if (match) this.#choose(match);
    this.#of.page.focus();
    return true;
  }

  chosen(): string {
    return this.#of.page.sheet.selection?.toString() ?? '';
  }

  valid(query: FindQuery): boolean {
    const matcher = matcherOf(query.search, optionsOf(query));
    return matcher !== null && matcher !== 'invalid';
  }

  query(query: FindQuery, narrow: boolean): void {
    const matcher = matcherOf(query.search, optionsOf(query));
    this.#invalid = matcher === 'invalid';
    this.#at = -1;
    this.#narrowing = narrow;
    this.#search.search(this.#of.epub(), matcher === 'invalid' ? null : matcher, this.#of.still);
  }

  next(): boolean {
    return this.#step(1);
  }

  previous(): boolean {
    return this.#step(-1);
  }

  count(): FindCount | 'invalid' {
    if (this.#invalid) return 'invalid';
    const { found, more } = this.#search;
    return { current: this.#at + 1, total: found.length, more };
  }

  /** The chapter drawn anew (or another): its matches inked again. */
  paint(): void {
    const spine = this.#of.spine();
    const { chapter } = this.#of.page;
    const mine = this.#open ? this.#search.found.filter((match) => match.spine === spine) : [];
    const walk = walked(chapter);
    this.#found.paint(walk, mine);
    const current = this.#search.found[this.#at];
    this.#current.paint(walk, this.#open && current?.spine === spine ? [current] : []);
  }

  /** A turn's copy of the page, its words from `from` on, inked as the page is. */
  inkCopy(copy: HTMLElement, from: number): void {
    const spine = this.#of.spine();
    const mine = this.#open ? this.#search.found.filter((match) => match.spine === spine) : [];
    if (mine.length > 0) inkCopy(walked(copy), from, 'epub-found', mine);
  }

  /** Spine item and words of `match` shown and chosen on the page (a Found row's, Phase 5c). */
  async goToMatch(match: Found): Promise<void> {
    await this.#of.goTo(match.spine, match.from);
    if (this.#of.spine() === match.spine) this.#choose(match);
  }

  /** Another book on the page, or none: nothing of the last one's found kept, the bar shut. */
  forget(): void {
    this.#open = false;
    this.#at = -1;
    this.#search.search(null, null, this.#of.still);
    this.bar.shown(false);
    this.#found.clear();
    this.#current.clear();
  }

  dispose(): void {
    this.forget();
    this.bar.element.remove();
  }

  /** On to the next match past the words in sight, or the one before, round the book. */
  #step(way: 1 | -1): boolean {
    const { found } = this.#search;
    if (found.length === 0) return false;
    const at = this.#at;
    const index =
      at >= 0
        ? (at + way + found.length) % found.length
        : (walkPlaces(found, placeOf, this.#sight(), way)?.index ?? 0);
    void this.#show(index);
    return true;
  }

  /** The words in sight now: from the place to itself (the place's own word). */
  #sight() {
    const from = this.#of.page.sheet.place;
    return { spine: this.#of.spine(), from, to: from };
  }

  /** Matches arrived: as a letter typed narrows, the first at or past the place shown. */
  #changed(): void {
    if (this.#narrowing && this.#at < 0) {
      const { found, done } = this.#search;
      const sight = this.#sight();
      const ahead = found.findIndex(
        (match) =>
          match.spine > sight.spine || (match.spine === sight.spine && match.from >= sight.from),
      );
      if (ahead >= 0 || (done && found.length > 0)) {
        this.#narrowing = false;
        void this.#show(Math.max(0, ahead));
      }
    }
    this.bar.changed();
    this.paint();
  }

  /** Match `index` shown: its chapter drawn if need be, its words inked as the one Find is on. */
  async #show(index: number): Promise<void> {
    const match = this.#search.found[index];
    if (!match) return;
    this.#at = index;
    await this.#of.goTo(match.spine, match.from);
    this.#clearOfBar();
    this.paint();
    this.bar.changed();
  }

  /**
   * Scrolling, the match's line clear of the bar, which lies over the page's
   * top, as a note's Find scrolls its match (../editor/find.ts scrollTo). In
   * pages the page holding it is shown whole, as a page must be.
   */
  #clearOfBar(): void {
    const { page } = this.#of;
    if (!this.#open || page.sheet.paged) return;
    const { scroller } = page;
    const over =
      this.bar.element.getBoundingClientRect().bottom - scroller.getBoundingClientRect().top;
    if (over > 0) scroller.scrollTop -= over;
  }

  /** `match`'s words chosen on the page, if its chapter is the one drawn. */
  #choose(match: Found): void {
    if (match.spine !== this.#of.spine()) return;
    const bounds = boundsOf(walked(this.#of.page.chapter), match);
    if (!bounds) return;
    const selection = document.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(rangeOver(bounds));
  }
}
