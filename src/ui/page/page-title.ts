// A page's title: the note's name (spec §2). A click, Enter or F2 makes it a
// field, the words chosen; Enter keeps what's typed, Esc doesn't. A note that
// opens with its own "# Title" heading doesn't show it twice.

import { opensWithTitle } from '../../core/note';
import { h } from '../dom';

export interface TitleEvents {
  /** A title the writer typed, different from the one there. */
  rename(typed: string): void;
  /** Back to the words: the field left, nothing renamed. */
  done(): void;
  /** The note's text now, for whether it opens with its own heading. */
  text(): string;
}

export class PageTitle {
  readonly element = h('h1', {
    class: 'title',
    attrs: { tabindex: '0', title: 'Rename', 'aria-keyshortcuts': 'Enter F2' },
  });
  /** The title as a field, while it's being renamed. */
  readonly field = h('input', {
    class: 'title__field',
    attrs: { type: 'text', 'aria-label': 'Title', spellcheck: 'false', hidden: true },
  });
  #text = '';
  readonly #events: TitleEvents;

  constructor(events: TitleEvents) {
    this.#events = events;
    this.element.addEventListener('click', () => this.edit());
    this.element.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== 'F2') return;
      event.preventDefault();
      this.edit();
    });
    this.field.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') this.#finish(true);
      else if (event.key === 'Escape') this.#finish(false);
      else return;
      event.preventDefault();
    });
    // Switching to another app isn't leaving the field: the half-typed title waits.
    this.field.addEventListener('blur', () => {
      if (document.hasFocus()) this.#finish(true);
    });
  }

  /** The note's name. */
  get text(): string {
    return this.#text;
  }

  /** The note's name, with its text (`text`) to see whether it opens with it. */
  set(title: string, text: string): void {
    this.element.textContent = this.#text = title;
    this.follow(text);
  }

  /** Make it a field, the words chosen. */
  edit(): void {
    this.field.value = this.#text;
    this.field.hidden = false;
    this.element.hidden = true;
    this.field.focus();
    this.field.select();
  }

  /** The note's text changed: shown, unless it opens with its own heading. */
  follow(text: string): void {
    if (!this.field.hidden) return; // being renamed: the field stands in for it
    this.element.hidden = opensWithTitle(text, this.#text);
  }

  #finish(keep: boolean): void {
    if (this.field.hidden) return;
    const typed = this.field.value;
    this.field.hidden = true;
    this.follow(this.#events.text());
    if (keep && typed.trim() && typed !== this.#text) this.#events.rename(typed);
    else this.#events.done();
  }
}
