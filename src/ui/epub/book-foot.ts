// A book's own items in the colophon (#40; ../page/page-leaf.ts, LeafFoot),
// as a note's are (../page/note-foot.ts): Back, after a link was followed
// (Phase 2b), first, so where the split gives each page its own foot it goes
// there with them; which chapter of how many; the page (Phase 4: the printed
// edition's, else a steady one); how far through the chapter and the book
// (Phase 2); and a line of news for a while (Quote's, Phase 2c), with a word
// button to undo what it says, as long as it shows (Put back, a highlight
// taken off, Phase 5a).

import { percent } from '../../core/epub';
import { h } from '../dom';
import type { LeafFoot } from '../page/page-leaf';
import { Notice } from '../vault/notice';

/** What a line of news offers to undo while it shows: its word, and what it does. */
export interface Undo {
  readonly label: string;
  run(): void;
}

export class BookFoot implements LeafFoot {
  readonly lead = h('span');
  readonly trail = h('span');
  readonly said = h('span', { class: 'colophon__said', attrs: { role: 'status' } });
  readonly figures: readonly HTMLElement[];
  readonly #back: HTMLButtonElement;
  readonly #at = h('span', { class: 'colophon__chapter count' });
  readonly #page = h('span', { class: 'colophon__page count' });
  /**
   * "bookmarked": seen only where the page can't wear its mark, a book in
   * Facing pages' folio; elsewhere heard alone (./bookmark.css).
   */
  readonly #bookmarked = h('span', { class: 'colophon__bookmarked colophon__heard count' });
  /** "highlighted": heard alone, the page's ink says it to the eye (Phase 5a, ./ink.css). */
  readonly #highlighted = h('span', { class: 'colophon__heard count' });
  /** What the news offers to undo, while it shows. */
  readonly #undo: HTMLButtonElement;
  readonly #inChapter = h('span', { class: 'colophon__through count' });
  readonly #inBook = h('span', { class: 'colophon__through count' });
  readonly #saying = new Notice(() => {
    this.said.textContent = this.#saying.text ?? '';
    if (this.#saying.text === null) this.#offer(null);
  });
  /** Where the keyboard goes when the word it's on goes with its news. */
  readonly #home: () => void;
  #undoing: (() => void) | null = null;

  /** `back`: back where the last link was followed from; `home`, the keyboard to the page. */
  constructor(back: () => void, home: () => void) {
    this.#home = home;
    this.#undo = h('button', {
      class: 'word-button',
      attrs: { type: 'button', hidden: true },
      on: {
        click: () => {
          const undo = this.#undoing;
          this.#offer(null);
          undo?.();
        },
      },
    });
    this.#back = h('button', {
      class: 'word-button',
      attrs: {
        type: 'button',
        hidden: true,
        'aria-keyshortcuts': 'Meta+[ Control+[ Alt+ArrowLeft',
      },
      on: { click: back },
    });
    this.figures = [
      this.#back,
      this.#at,
      this.#page,
      this.#bookmarked,
      this.#highlighted,
      this.#inChapter,
      this.#inBook,
      // Last, beside the news it undoes.
      this.#undo,
    ];
  }

  /** Whether there's a step back to offer. */
  get canGoBack(): boolean {
    return !this.#back.hidden;
  }

  /** Which chapter of how many, as the colophon says it ("3 of 61"). */
  at(words: string): void {
    this.#at.textContent = words;
  }

  /** The page the place is on, as said ("page 212 of 2,450"), or nothing: none known yet. */
  page(words: string): void {
    this.#page.textContent = words;
  }

  /** Whether the page in sight is bookmarked (Phase 4b). */
  bookmarked(on: boolean): void {
    this.#bookmarked.textContent = on ? 'bookmarked' : '';
  }

  /** Whether the page in sight holds a highlight (Phase 5a). */
  highlighted(on: boolean): void {
    this.#highlighted.textContent = on ? 'highlighted' : '';
  }

  /** How far through the chapter and the book, 0 to 1 each. */
  through(chapter: number, book: number): void {
    this.#inChapter.textContent = `${percent(chapter)} of the chapter`;
    this.#inBook.textContent = `${percent(book)} of the book`;
  }

  /** Back where a link was followed from, named (its chapter), or none. */
  backTo(name: string | null): void {
    this.#back.hidden = name === null;
    this.#back.textContent = name === null ? '' : `Back to ${name}`;
  }

  /** A line of news, for a while, and what it offers to undo while it shows. */
  say(words: string, undo?: Undo): void {
    this.#saying.tell(words);
    this.#offer(undo ?? null);
  }

  #offer(undo: Undo | null): void {
    const had = document.activeElement === this.#undo;
    this.#undoing = undo?.run ?? null;
    this.#undo.textContent = undo?.label ?? '';
    this.#undo.hidden = undo === null;
    // Its word gone with the keyboard on it: back to the page, never lost to the window.
    if (had && undo === null) this.#home();
  }

  /** No chapter: nothing said of one. */
  clear(): void {
    for (const figure of [
      this.#at,
      this.#page,
      this.#bookmarked,
      this.#highlighted,
      this.#inChapter,
      this.#inBook,
    ])
      figure.textContent = '';
    this.backTo(null);
  }

  stop(): void {
    this.#saying.stop();
  }
}
