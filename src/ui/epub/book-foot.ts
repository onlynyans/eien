// A book's own items in the colophon (#40; ../page/page-leaf.ts, LeafFoot),
// as a note's are (../page/note-foot.ts): Back, after a link was followed
// (Phase 2b), first, so where the split gives each page its own foot it goes
// there with them; which chapter of how many; the page (Phase 4: the printed
// edition's, else a steady one); how far through the chapter and the book
// (Phase 2); and a line of news for a while (Quote's, Phase 2c).

import { percent } from '../../core/epub';
import { h } from '../dom';
import type { LeafFoot } from '../page/page-leaf';
import { Notice } from '../vault/notice';

export class BookFoot implements LeafFoot {
  readonly lead = h('span');
  readonly trail = h('span');
  readonly said = h('span', { class: 'colophon__said', attrs: { role: 'status' } });
  readonly figures: readonly HTMLElement[];
  readonly #back: HTMLButtonElement;
  readonly #at = h('span', { class: 'colophon__chapter count' });
  readonly #page = h('span', { class: 'colophon__page count' });
  readonly #inChapter = h('span', { class: 'colophon__through count' });
  readonly #inBook = h('span', { class: 'colophon__through count' });
  readonly #saying = new Notice(() => {
    this.said.textContent = this.#saying.text ?? '';
  });

  /** `back`: back where the last link was followed from. */
  constructor(back: () => void) {
    this.#back = h('button', {
      class: 'word-button',
      attrs: {
        type: 'button',
        hidden: true,
        'aria-keyshortcuts': 'Meta+[ Control+[ Alt+ArrowLeft',
      },
      on: { click: back },
    });
    this.figures = [this.#back, this.#at, this.#page, this.#inChapter, this.#inBook];
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

  /** A line of news, for a while. */
  say(words: string): void {
    this.#saying.tell(words);
  }

  /** No chapter: nothing said of one. */
  clear(): void {
    for (const figure of [this.#at, this.#page, this.#inChapter, this.#inBook])
      figure.textContent = '';
    this.backTo(null);
  }

  stop(): void {
    this.#saying.stop();
  }
}
