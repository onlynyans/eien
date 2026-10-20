// Where outline cards lie (ui/outline): on the blotter, in the sheet's place.
// While they're up the sheet is out of sight but kept as it was — its place
// in a long chapter comes back with it — and whatever needs the page (a
// view chosen, Compare) gives it back first, so nothing acts on a page the
// writer can't see.

import { h } from '../dom';

/** What lies in the sheet's place. */
export interface Board {
  readonly element: HTMLElement;
  /** The keyboard to it. */
  focus(): void;
  /** It was taken away (the page given back): whoever showed it hears so, and whether it had the keyboard. */
  closed(hadKeyboard: boolean): void;
}

export class BoardHost {
  readonly element = h('div', { class: 'page__board', attrs: { hidden: true } });
  readonly #scroll: HTMLElement;
  #board: Board | null = null;
  /** How far down the sheet was scrolled when the board came. */
  #sheetAt = 0;

  /** `scroll` holds the sheet and the board: the one scrolled, the other kept still. */
  constructor(scroll: HTMLElement) {
    this.#scroll = scroll;
  }

  get shown(): boolean {
    return this.#board !== null;
  }

  show(board: Board): void {
    if (!this.#board) this.#sheetAt = this.#scroll.scrollTop;
    this.#board = board;
    this.element.replaceChildren(board.element);
    this.element.hidden = false;
    this.#scroll.toggleAttribute('data-board', true);
    this.#scroll.scrollTop = 0;
  }

  /** The sheet back where it was; the board's owner told. */
  hide(): void {
    const board = this.#board;
    if (!board) return;
    const had = this.element.contains(document.activeElement);
    this.#board = null;
    this.element.replaceChildren();
    this.element.hidden = true;
    this.#scroll.toggleAttribute('data-board', false);
    this.#scroll.scrollTop = this.#sheetAt;
    board.closed(had);
  }

  focus(): void {
    this.#board?.focus();
  }
}
