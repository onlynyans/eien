// Outline cards (spec §4): a book's chapters as index cards on the blotter,
// in the book's order — each its number, title, first line and words. A
// card opens its chapter; dragging one, or Alt and an arrow, puts it in
// another place in the book. Esc goes back to the page.

import { PREVIEW_LENGTH } from '../../core/note';
import { h } from '../dom';
import { watchDrags } from '../list/drag';
import type { NoteList } from '../vault/vault-state';

/** A card's first lines: the index's preview, cut at a word and marked as cut when it was. */
export const summaryOf = (preview: string): string =>
  preview.length >= PREVIEW_LENGTH ? `${preview.replace(/\s+\S*$/u, '')}…` : preview;

export interface BoardActions {
  open(path: string): void;
  /** Place the chapter at `path` just before `before` (last, for null). */
  placeBefore(path: string, before: string | null): void;
  /** One place earlier or later. */
  nudge(path: string, by: -1 | 1): void;
  close(): void;
}

export class OutlineBoard {
  readonly element: HTMLElement;
  readonly #heading = h('h2', { class: 'label' });
  readonly #count = h('span', { class: 'board__count count' });
  readonly #cards = h('ul', { class: 'board__cards' });
  readonly #actions: BoardActions;

  constructor(actions: BoardActions) {
    this.#actions = actions;
    const close = h('button', {
      class: 'word-button',
      text: 'Close',
      attrs: { type: 'button' },
      on: { click: () => actions.close() },
    });
    this.element = h(
      'section',
      { class: 'board', attrs: { 'aria-labelledby': 'board-heading' } },
      h('header', { class: 'board__head' }, this.#heading, this.#count, close),
      this.#cards,
    );
    this.#heading.id = 'board-heading';
    this.#cards.addEventListener('keydown', (event) => this.#key(event));
    watchDrags(
      this.#cards,
      { orderable: () => true, moveTo: () => {}, placeBefore: actions.placeBefore },
      '.card[data-path]',
      true,
    );
  }

  /** Draw `book`'s chapters, the one at `current` marked; the keyboard stays on its card. */
  show(book: NoteList, current: string | null): void {
    const focused = (document.activeElement as HTMLElement | null)?.dataset?.path;
    const words = book.notes.reduce((sum, note) => sum + note.words, 0);
    this.#heading.textContent = `${book.heading} · outline`;
    this.#count.textContent = `${book.notes.length} ${book.notes.length === 1 ? 'chapter' : 'chapters'} · ${words.toLocaleString('en')} words`;
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
                'aria-label': `${note.ordinal ?? ''} ${note.title}`.trim(),
              },
              on: { click: () => this.#actions.open(note.path) },
            },
            h('span', { class: 'card__number count', text: note.ordinal ?? '' }),
            h('span', { class: 'card__title', text: note.title }),
            h('span', { class: 'card__summary', text: summaryOf(note.preview) }),
            h('span', { class: 'card__words count', text: `${note.words.toLocaleString('en')} w` }),
          ),
        ),
      ),
    );
    if (book.notes.length === 0) {
      this.#cards.append(h('li', { class: 'board__empty', text: 'No chapters yet.' }));
    }
    const back = focused && this.#card(focused);
    if (back) back.focus();
  }

  /** The keyboard to the current chapter's card, or the first. */
  focus(): void {
    (
      this.#cards.querySelector<HTMLElement>('.card[aria-current="true"]') ??
      this.#cards.querySelector<HTMLElement>('.card')
    )?.focus();
  }

  #card(path: string): HTMLElement | undefined {
    return this.#all().find((card) => card.dataset.path === path);
  }

  #all(): HTMLElement[] {
    return [...this.#cards.querySelectorAll<HTMLElement>('.card[data-path]')];
  }

  /** Arrows move between cards (up and down by a row); Alt and an arrow moves the card; Esc leaves. */
  #key(event: KeyboardEvent): void {
    const cards = this.#all();
    const at = cards.indexOf(document.activeElement as HTMLElement);
    if (event.key === 'Escape') this.#actions.close();
    else if (at < 0) return;
    else if (event.altKey && event.key.startsWith('Arrow')) {
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
      cards[Math.max(0, Math.min(cards.length - 1, next))]?.focus();
    }
    event.preventDefault();
    event.stopPropagation();
  }
}
