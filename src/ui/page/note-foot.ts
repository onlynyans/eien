// A note's own items in the colophon (./page-leaf.ts, LeafFoot): its tags
// (C's), its words, its save (only a failure is worth a word), its last seal,
// and what the table editor just did, for a while. The pane puts them where
// the split's mode says (./page-pane.ts).

import { h } from '../dom';
import type { SaveState } from '../notes/note-session';
import { Notice } from '../vault/notice';
import type { LeafFoot } from './page-leaf';

/** What the colophon says of the save: only a failure is worth a word. */
const STATE_WORDS: Partial<Record<SaveState, string>> = { failed: 'Not saved yet — trying again' };

export class NoteFoot implements LeafFoot {
  readonly lead: HTMLElement;
  readonly figures: readonly HTMLElement[];
  readonly #state = h('span', { class: 'colophon__state', attrs: { role: 'status' } });
  /** The last seal. */
  readonly trail = h('span', { class: 'colophon__seal' });
  /** What the table editor just did ("Row 3 removed · ⌘Z puts it back"), for a while. */
  readonly said = h('span', { class: 'colophon__said', attrs: { role: 'status' } });
  readonly #saying = new Notice(() => {
    this.said.textContent = this.#saying.text ?? '';
  });

  /** `tags`, the layout's colophon slot for them; `words`, the note's count. */
  constructor(tags: HTMLElement, words: HTMLElement) {
    this.lead = tags;
    this.figures = [words, this.#state];
  }

  state(state: SaveState): void {
    this.#state.textContent = STATE_WORDS[state] ?? '';
    this.#state.dataset.state = state;
  }

  /** Say `words` for a while. */
  tell(words: string): void {
    this.#saying.tell(words);
  }

  stop(): void {
    this.#saying.stop();
  }
}
