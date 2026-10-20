// The note's words in the colophon (spec §4: its words only — not marks,
// addresses, HTML tags or the front matter), counted once typing pauses;
// and what the writer's own changes added or took away, for today's words
// and a sprint. A note opened, reloaded from elsewhere, sealed or restored
// is counted afresh: that's no one writing.

import { countWords } from '../../core/text';
import { h } from '../dom';

/** How long typing pauses before the count catches up. */
const COUNT_AFTER_MS = 250;

export class WordCount {
  readonly element = h('span', { class: 'colophon__words' });
  /** The words shown: what the next writing is measured from. */
  #words = 0;
  /** The writer's latest text, not counted yet. */
  #pending: string | null = null;
  #timer: ReturnType<typeof setTimeout> | undefined;
  #wrote: (added: number) => void = () => {};
  #counted: (words: number) => void = () => {};

  /** `wrote` hears the words each stretch of writing added (or, below 0, took away). */
  onWrote(wrote: (added: number) => void): void {
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
    this.#flush();
    this.#show(countWords(text));
  }

  /** A change in the editor: the writer's counted once typing pauses; Eien's at once. */
  edited(text: string, written: boolean): void {
    if (!written) {
      this.show(text);
      return;
    }
    this.#pending = text;
    clearTimeout(this.#timer);
    this.#timer = setTimeout(() => this.#flush(), COUNT_AFTER_MS);
  }

  /** No note: what was being written is counted, and nothing is shown. */
  clear(): void {
    this.#flush();
    this.#words = 0;
    this.element.textContent = '';
  }

  #flush(): void {
    clearTimeout(this.#timer);
    if (this.#pending === null) return;
    const words = countWords(this.#pending);
    this.#pending = null;
    const added = words - this.#words;
    this.#show(words);
    if (added !== 0) this.#wrote(added);
  }

  #show(words: number): void {
    this.#words = words;
    this.element.textContent = `${words.toLocaleString()} ${words === 1 ? 'word' : 'words'}`;
    this.#counted(words);
  }
}
