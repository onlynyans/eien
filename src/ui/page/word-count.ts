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
  /** Another page's change to the note, not counted yet (see `echoed`). */
  #echo: string | null = null;
  readonly #wrote = new Set<(added: number, when: Written) => void>();
  readonly #counted = new Set<(words: number) => void>();

  /**
   * `wrote` hears the words each stretch of writing added (or, below 0, took
   * away), and when. Returns a function to stop.
   */
  onWrote(wrote: (added: number, when: Written) => void): () => void {
    this.#wrote.add(wrote);
    return () => this.#wrote.delete(wrote);
  }

  /** `counted` hears the note's words each time they're counted. Returns a function to stop. */
  onCounted(counted: (words: number) => void): () => void {
    this.#counted.add(counted);
    return () => this.#counted.delete(counted);
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

  /**
   * The same note changed on another page, which counts what its writer added:
   * this page's count follows once typing pauses, and adds nothing; what was
   * typed here before it is counted first.
   */
  echoed(text: string): void {
    this.flush();
    this.#echo = text;
    this.#timer = setTimeout(() => this.#settle(), COUNT_AFTER_MS);
  }

  /** A change in the editor: the writer's counted once typing pauses; Eien's at once. */
  edited(text: string, written: boolean): void {
    this.#settle(); // another page's words are no one's here: the count starts after them
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
    this.#settle();
    if (this.#pending === null) return;
    const words = countWords(this.#pending);
    this.#pending = null;
    const added = words - this.#words;
    this.#show(words);
    if (added !== 0)
      for (const wrote of this.#wrote) wrote(added, { from: this.#since, to: this.#lately });
  }

  /** Another page's change, counted as where this page starts from. */
  #settle(): void {
    if (this.#echo === null) return;
    const text = this.#echo;
    this.#echo = null;
    this.#show(countWords(text));
  }

  #show(words: number): void {
    this.#words = words;
    this.element.textContent = `${words.toLocaleString()} ${words === 1 ? 'word' : 'words'}`;
    for (const counted of this.#counted) counted(words);
  }
}
