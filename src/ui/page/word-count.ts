// The note's words in the colophon (spec §4: its words only — not marks,
// addresses, HTML tags or the front matter), counted once typing pauses;
// and what the writer's own changes added or took away, for today's words
// and a sprint. A note opened, reloaded from elsewhere, sealed or restored
// is counted afresh: that's no one writing.

import { countWords } from '../../core/text';
import { h } from '../dom';

/** How long typing pauses before the count catches up. */
const COUNT_AFTER_MS = 250;

/** When a stretch of writing happened: its first and last change, in milliseconds since the epoch. */
export interface Written {
  readonly from: number;
  readonly to: number;
}

export class WordCount {
  readonly element = h('span', { class: 'colophon__words' });
  /** The words shown: what the next writing is measured from. */
  #words = 0;
  /** The writer's latest text, not counted yet, and when the writing began and last went on. */
  #pending: string | null = null;
  #since = 0;
  #lately = 0;
  #timer: ReturnType<typeof setTimeout> | undefined;
  #wrote: (added: number, when: Written) => void = () => {};
  #counted: (words: number) => void = () => {};

  /** `wrote` hears the words each stretch of writing added (or, below 0, took away), and when. */
  onWrote(wrote: (added: number, when: Written) => void): void {
    this.#wrote = wrote;
  }

  /** `counted` hears the note's words each time they're counted. */
  onCounted(counted: (words: number) => void): void {
    this.#counted = counted;
  }

  /** The words of the open note, as last counted. */
  get words(): number {
    return this.#words;
  }

  /** A note shown, or its text from elsewhere: counted now, written by no one here. */
  show(text: string): void {
    this.flush();
    this.#show(countWords(text));
  }

  /** A change in the editor: the writer's counted once typing pauses; Eien's at once. */
  edited(text: string, written: boolean): void {
    if (!written) {
      this.show(text);
      return;
    }
    const now = Date.now();
    if (this.#pending === null) this.#since = now;
    this.#lately = now;
    this.#pending = text;
    clearTimeout(this.#timer);
    this.#timer = setTimeout(() => this.flush(), COUNT_AFTER_MS);
  }

  /** No note: what was being written is counted, and nothing is shown. */
  clear(): void {
    this.flush();
    this.#words = 0;
    this.element.textContent = '';
  }

  /** Count what the writer has written now, without waiting for a pause: the window closing, a sprint's end. */
  flush(): void {
    clearTimeout(this.#timer);
    if (this.#pending === null) return;
    const words = countWords(this.#pending);
    this.#pending = null;
    const added = words - this.#words;
    this.#show(words);
    if (added !== 0) this.#wrote(added, { from: this.#since, to: this.#lately });
  }

  #show(words: number): void {
    this.#words = words;
    this.element.textContent = `${words.toLocaleString()} ${words === 1 ? 'word' : 'words'}`;
    this.#counted(words);
  }
}
