// Outline cards (spec §4): a book's chapters as index cards on the blotter,
// in the book's order — each its number, title, first lines and words. A
// card opens its chapter; dragging one, or Alt and an arrow, puts it in
// another place in the book (or, dropped on a folder, moves it there). The
// keyboard is always on a card or the Close button; Esc goes back to the page.

import { PREVIEW_LENGTH } from '../../core/note';
import { h } from '../dom';
import { watchDrags } from '../list/drag';
import type { NoteList } from '../vault/vault-state';

const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

/** How far back from a cut preview's end a word's start is looked for. */
const WORD_REACH = 24;

/**
 * A card's first lines: the index's preview, marked "…" when the index cut
 * it (it keeps PREVIEW_LENGTH characters as seen, its last spaces trimmed),
 * and then cut at a word if one ends near — writing with no spaces between
 * words (Japanese) is cut where it is.
 */
export function summaryOf(preview: string): string {
  const seen = [...segmenter.segment(preview)].length;
  if (seen < PREVIEW_LENGTH - 2) return preview;
  const space = preview.search(new RegExp(`\\s\\S{0,${WORD_REACH}}$`, 'u'));
  return `${space > 0 ? preview.slice(0, space) : preview}…`;
}

export interface BoardActions {
  open(path: string): void;
  /** Place the chapter at `path` just before `before` (last, for null). */
  placeBefore(path: string, before: string | null): void;
  /** Move the chapter at `path` into `folder`: dropped on a folder in the sidebar. */
  moveTo(path: string, folder: string): void;
  /** One place earlier or later. */
  nudge(path: string, by: -1 | 1): void;
  close(): void;
}

export class OutlineBoard {
  readonly element: HTMLElement;
  readonly #heading = h('h2', { class: 'label' });
  readonly #count = h('span', { class: 'board__count count' });
  readonly #cards = h('ul', { class: 'board__cards' });
  readonly #close: HTMLButtonElement;
  readonly #actions: BoardActions;

  constructor(actions: BoardActions) {
    this.#actions = actions;
    this.#close = h('button', {
      class: 'word-button',
      text: 'Close',
      attrs: { type: 'button' },
      on: { click: () => actions.close() },
    });
    this.element = h(
      'section',
      { class: 'board', attrs: { 'aria-labelledby': 'board-heading' } },
      h('header', { class: 'board__head' }, this.#heading, this.#count, this.#close),
      this.#cards,
    );
    this.#heading.id = 'board-heading';
    this.element.addEventListener('keydown', (event) => this.#key(event));
    watchDrags(
      this.#cards,
      { orderable: () => true, moveTo: actions.moveTo, placeBefore: actions.placeBefore },
      '.card[data-path]',
      true,
    );
  }

  /** Draw `book`'s chapters, the one at `current` marked; the keyboard stays on the board. */
  show(book: NoteList, current: string | null): void {
    const focused = document.activeElement as HTMLElement | null;
    const had = focused !== null && this.element.contains(focused);
    const at = this.#all().indexOf(focused as HTMLElement);
    const words = book.notes.reduce((sum, note) => sum + note.words, 0);
    this.#heading.textContent = `${book.heading} · outline`;
    this.#count.textContent = `${book.notes.length} ${book.notes.length === 1 ? 'chapter' : 'chapters'} · ${words.toLocaleString()} words`;
    this.#cards.replaceChildren(
      ...book.notes.map((note) =>
        h(
          'li',
          {},
          h(
            'button',
            {
              class: 'card',
              attrs: {
                type: 'button',
                'data-path': note.path,
                'aria-current': note.path === current ? 'true' : undefined,
              },
              on: { click: () => this.#actions.open(note.path) },
            },
            h('span', { class: 'card__number count', text: note.ordinal ?? '' }),
            h('span', { class: 'card__title', text: note.title }),
            h('span', { class: 'card__summary', text: summaryOf(note.preview) }),
            h('span', { class: 'card__words count', text: `${note.words.toLocaleString()} w` }),
          ),
        ),
      ),
    );
    if (book.notes.length === 0) {
      this.#cards.append(h('li', { class: 'board__empty', text: 'No chapters yet.' }));
    }
    if (!had || this.element.contains(document.activeElement)) return;
    // Its card gone (renamed, moved elsewhere): the card now in its place, or Close.
    const cards = this.#all();
    const path = focused?.dataset.path;
    (
      cards.find((card) => card.dataset.path === path) ??
      cards[Math.min(at, cards.length - 1)] ??
      this.#close
    ).focus();
  }

  /** The keyboard to the current chapter's card, the first, or (no chapters) Close. */
  focus(): void {
    (
      this.#cards.querySelector<HTMLElement>('.card[aria-current="true"]') ??
      this.#cards.querySelector<HTMLElement>('.card') ??
      this.#close
    ).focus();
  }

  #all(): HTMLElement[] {
    return [...this.#cards.querySelectorAll<HTMLElement>('.card[data-path]')];
  }

  /** Esc leaves; on a card, arrows move between cards (a row up or down), Alt and an arrow moves it. */
  #key(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.#actions.close();
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    const cards = this.#all();
    const at = cards.indexOf(document.activeElement as HTMLElement);
    if (at < 0) return;
    if (event.altKey && event.key.startsWith('Arrow')) {
      const by = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1;
      const path = cards[at]?.dataset.path;
      if (path) this.#actions.nudge(path, by);
    } else {
      const row = cards.filter((card) => card.offsetTop === cards[0]?.offsetTop).length || 1;
      const to: Record<string, number> = {
        ArrowLeft: at - 1,
        ArrowRight: at + 1,
        ArrowUp: at - row,
        ArrowDown: at + row,
        Home: 0,
        End: cards.length - 1,
      };
      const next = to[event.key];
      if (next === undefined) return;
      // Past the first row or the last, the keyboard stays where it is.
      cards[next >= 0 && next < cards.length ? next : at]?.focus();
    }
    event.preventDefault();
    event.stopPropagation();
  }
}
