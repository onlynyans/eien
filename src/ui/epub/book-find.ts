// Find in a book (#40, Phase 5c; the owner's answer, 2026-10-31: ⌘F opens
// the page's own find bar, as on a note): what the window's find bar
// (../find/find-bar.ts) searches over a book's page, the whole book in the
// background (./book-search.ts), never Replace. Every match in the chapter
// drawn is inked in the chosen row's wash, the one Find is on in the
// selection's (./ink.ts): painted, not chosen, while a field has the
// keyboard, as a choice in the page would take its typing; chosen as the
// bar closes, so the words are the page's selection to quote or highlight,
// as a note's Find leaves its match chosen. A match the list's Found points
// to from its field (Enter) is painted the same way.

import { type Epub, type Found, matcherOf } from '../../core/epub';
import type { FindCount } from '../../core/find';
import { FindBar } from '../find/find-bar';
import type { FindQuery, FindTarget } from '../find/find-target';
import type { BookSearch } from './book-search';
import { boundsOf, rangeOver, walked } from './chapter-range';
import type { EpubPage } from './epub-page';
import { type CopyInk, Ink } from './ink';
import type { Still } from './still';

export interface BookFindOf {
  readonly page: EpubPage;
  /** A search of the page's own over the window's chapters read (./book-search.ts). */
  readonly search: (changed: () => void) => BookSearch;
  epub(): Epub | null;
  /** The spine item drawn; -1 for none. */
  spine(): number;
  /** `then` once no page of the window's turns. */
  still: Still;
  /** Show spine item `index` at an offset in its words, once drawn. */
  goTo(index: number, offset: number): Promise<void>;
}

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
  /** A step asked for before the search had looked where it goes: taken once it has. */
  #waiting: 1 | -1 | null = null;
  /** A match the list's Found pointed to from its field, painted as the one it's on. */
  #pointed: Found | null = null;

  constructor(of: BookFindOf) {
    this.#of = of;
    this.#search = of.search(() => this.#changed());
    this.bar = new FindBar(this, 'Find in the book');
    of.page.element.append(this.bar.element);
  }

  open(): void {
    this.#open = true;
    this.#pointed = null;
    this.bar.shown(true);
    this.paint();
  }

  close(): boolean {
    if (!this.#open) return false;
    this.#open = false;
    this.#waiting = null;
    this.#search.stop();
    this.bar.shown(false);
    this.paint();
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
    const matcher = matcherOf(query.search, query);
    return matcher !== null && matcher !== 'invalid';
  }

  query(query: FindQuery, narrow: boolean): void {
    const matcher = matcherOf(query.search, query);
    this.#invalid = matcher === 'invalid';
    this.#at = -1;
    this.#waiting = null;
    this.#narrowing = narrow;
    this.#search.search(this.#of.epub(), matcher === 'invalid' ? null : matcher, this.#of.still);
    // The last words' count and marks gone at once, not when the new ones' first arrive.
    this.bar.changed();
    this.paint();
  }

  next(): boolean {
    return this.#step(1);
  }

  previous(): boolean {
    return this.#step(-1);
  }

  count(): FindCount | 'invalid' {
    if (this.#invalid) return 'invalid';
    const { found, more, done } = this.#search;
    return { current: this.#at + 1, total: found.length, more, searching: !done };
  }

  /** The chapter drawn anew (or another), or what's found changed: its matches inked again. */
  paint(): void {
    const current = this.#currentMatch();
    if (!this.#open && !current) {
      this.#found.clear();
      this.#current.clear();
      return;
    }
    const spine = this.#of.spine();
    const walk = walked(this.#of.page.chapter);
    this.#found.paint(walk, this.#open ? this.#mine() : []);
    this.#current.paint(walk, current?.spine === spine ? [current] : []);
  }

  /** What a turn's copy of the page carries of Find: each ink, and its spans in the chapter drawn. */
  copySpans(): readonly CopyInk[] {
    const current = this.#currentMatch();
    return [
      { name: 'epub-found', spans: this.#open ? this.#mine() : [] },
      {
        name: 'epub-found-current',
        spans: current?.spine === this.#of.spine() ? [current] : [],
      },
    ];
  }

  /**
   * Spine item and words of `match` shown: chosen on the page (a Found row
   * clicked), or, from a field that keeps the keyboard (Enter in the list's
   * field), painted as the one it's on.
   */
  async goToMatch(match: Found, choose: boolean): Promise<void> {
    this.#pointed = choose ? null : match;
    await this.#of.goTo(match.spine, match.from);
    if (this.#of.spine() !== match.spine) return;
    if (choose) this.#choose(match);
    this.paint();
  }

  /** Another book on the page, or none: nothing of the last one's found kept, the bar shut. */
  forget(): void {
    this.#open = false;
    this.#at = -1;
    this.#waiting = null;
    this.#pointed = null;
    this.#search.clear();
    this.bar.shown(false);
    this.#found.clear();
    this.#current.clear();
  }

  dispose(): void {
    this.forget();
    this.bar.element.remove();
  }

  /** The match Find is on, while the bar is open; else one the list pointed to. */
  #currentMatch(): Found | null {
    return (this.#open ? this.#search.found[this.#at] : this.#pointed) ?? null;
  }

  /** The matches in the chapter drawn. */
  #mine(): Found[] {
    const spine = this.#of.spine();
    return this.#search.found.filter((match) => match.spine === spine);
  }

  /**
   * On to the next match (or back), from the one it's on or else the place,
   * round the book; once the search has looked there, if it hasn't yet.
   */
  #step(way: 1 | -1): boolean {
    const on = this.#search.found[this.#at];
    const walk = this.#search.walk(
      on?.spine ?? this.#of.spine(),
      on?.from ?? this.#of.page.sheet.place - 1,
      way,
    );
    if (walk === null) return false;
    if (walk === 'wait') {
      this.#waiting = way;
      return true;
    }
    void this.#show(walk.index);
    return true;
  }

  /** Matches arrived: a waiting step taken, or as a letter typed narrows, the first at or past the place shown. */
  #changed(): void {
    const waiting = this.#waiting;
    if (waiting) {
      this.#waiting = null;
      this.#step(waiting);
    } else if (this.#narrowing && this.#at < 0) {
      const walk = this.#search.walk(this.#of.spine(), this.#of.page.sheet.place - 1, 1);
      if (walk && walk !== 'wait') {
        this.#narrowing = false;
        void this.#show(walk.index);
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
