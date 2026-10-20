// The page: the open note on its sheet, and the status line beneath. In
// phase 3 the editor is a plain text area; Live, Source and Reading views
// arrive with the editor in phase 4.

import { countWords } from '../../core/text';
import { h } from '../dom';
import type { SaveState } from '../notes/note-session';

export interface PageNote {
  readonly crumbs: string;
  readonly title: string;
  readonly text: string;
}

const STATE_WORDS: Record<SaveState, string> = {
  saved: '',
  unsaved: '',
  saving: '',
  failed: 'Not saved yet — trying again',
};

export class PageView {
  readonly #crumbs = h('p', { class: 'crumbs label' });
  readonly #title = h('h1', { class: 'title' });
  readonly #notice = h('p', { class: 'notice', attrs: { role: 'status', hidden: true } });
  readonly #editor = h('textarea', {
    class: 'editor',
    attrs: { 'aria-label': 'Note', spellcheck: 'false' },
  });
  readonly #words = h('span', { class: 'colophon__words' });
  readonly #state = h('span', { class: 'colophon__state', attrs: { role: 'status' } });
  readonly #sheet = h(
    'article',
    { class: 'sheet' },
    this.#crumbs,
    this.#title,
    this.#notice,
    this.#editor,
  );
  readonly #empty = h('p', { class: 'page__empty', text: 'Choose a note, or make a new one.' });

  constructor(container: HTMLElement, onInput: (text: string) => void) {
    this.#editor.addEventListener('input', () => {
      this.#showWords();
      onInput(this.#editor.value);
    });
    container.replaceChildren(
      h('div', { class: 'page__bar' }),
      h('div', { class: 'page__scroll' }, this.#sheet, this.#empty),
      h('footer', { class: 'colophon count' }, this.#words, this.#state),
    );
    this.showNothing();
  }

  show(note: PageNote): void {
    this.#sheet.hidden = false;
    this.#empty.hidden = true;
    this.#crumbs.textContent = note.crumbs;
    this.#title.textContent = note.title;
    this.#editor.value = note.text;
    this.#editor.scrollTop = 0;
    this.notice(null);
    this.state('saved');
    this.#showWords();
  }

  showNothing(): void {
    this.#sheet.hidden = true;
    this.#empty.hidden = false;
    this.#words.textContent = '';
    this.state('saved');
  }

  /** New text from elsewhere, keeping the caret near where it was. */
  replaceText(text: string): void {
    const { selectionStart, selectionEnd } = this.#editor;
    this.#editor.value = text;
    this.#editor.setSelectionRange(
      Math.min(selectionStart, text.length),
      Math.min(selectionEnd, text.length),
    );
    this.#showWords();
  }

  retitle(title: string, crumbs: string): void {
    this.#title.textContent = title;
    this.#crumbs.textContent = crumbs;
  }

  /** A quiet line on the sheet, or none. */
  notice(text: string | null): void {
    this.#notice.hidden = text === null;
    this.#notice.textContent = text ?? '';
  }

  state(state: SaveState): void {
    this.#state.textContent = STATE_WORDS[state];
    this.#state.dataset.state = state;
  }

  focus(): void {
    this.#editor.focus();
  }

  #showWords(): void {
    const words = countWords(this.#editor.value);
    this.#words.textContent = `${words.toLocaleString()} ${words === 1 ? 'word' : 'words'}`;
  }
}
