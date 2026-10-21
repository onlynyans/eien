// The search field (spec §4). One field, in one of two places: on its own
// band at the top of the note list, searching the notes that list holds; or,
// with no list in sight (two panes, the list shut, a phone), under the
// vault's name in the sidebar, searching the whole vault. Moving it keeps
// its words, so a search carries on in its new place.

import { h, wordButton } from '../dom';

/** How long typing must pause before the search runs. */
const SEARCH_AFTER_MS = 150;

export class SearchField {
  /** The field and its Clear, moved whole from place to place. */
  readonly element: HTMLElement;
  readonly #input: HTMLInputElement;
  readonly #clear: HTMLButtonElement;
  readonly #search: (query: string) => void;
  #timer: ReturnType<typeof setTimeout> | undefined;

  /** `search` gets the field's words a moment after typing stops; "" when it's cleared. */
  constructor(search: (query: string) => void) {
    this.#search = search;
    this.#input = h('input', {
      class: 'field',
      attrs: {
        type: 'search',
        'aria-keyshortcuts': 'Meta+Shift+F Control+Shift+F',
        autocomplete: 'off',
        spellcheck: 'false',
      },
      on: {
        input: () => {
          this.#clear.hidden = !this.#input.value;
          clearTimeout(this.#timer);
          this.#timer = setTimeout(() => search(this.#input.value), SEARCH_AFTER_MS);
        },
        keydown: (event) => {
          if (event.key !== 'Escape') return;
          if (!this.#input.value) this.#input.blur();
          else {
            this.clear();
            search('');
          }
        },
      },
    });
    this.#clear = wordButton('Clear', () => this.clearAndSearch(), {
      'aria-label': 'Clear search',
      hidden: true,
    });
    this.element = h(
      'div',
      { class: 'search', attrs: { role: 'search' } },
      this.#input,
      this.#clear,
    );
  }

  /** Put the field in `slot` (if it isn't there), searching what `name` names. */
  place(slot: HTMLElement, name: string): void {
    const label = `Search ${name}`;
    this.#input.placeholder = label;
    this.#input.setAttribute('aria-label', label);
    // Only ever moved as its pane goes out of sight, which hands the keyboard to the page (spec §4).
    if (this.element.parentElement !== slot) slot.append(this.element);
  }

  /** Whether the field is in `slot`. */
  isIn(slot: HTMLElement): boolean {
    return this.element.parentElement === slot;
  }

  focus(): void {
    this.#input.focus();
    this.#input.select();
  }

  /** Empty the field, without searching for nothing. */
  clear(): void {
    clearTimeout(this.#timer);
    this.#input.value = '';
    this.#clear.hidden = true;
  }

  /** Empty the field and show what it hid: the list, or the tree; the keyboard stays in it. */
  clearAndSearch(): void {
    this.clear();
    this.#search('');
    this.#input.focus();
  }
}
