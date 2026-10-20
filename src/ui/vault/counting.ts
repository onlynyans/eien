// The colophon's counters for an open vault (spec §4): the writer's words go
// to today's tally and a sprint (../counters); the open note's book shows
// its words — the note's own counted live — and its goal.

import { Counters } from '../counters/counters';
import type { PageView } from '../page/page';
import type { OpenNote } from './open-note';
import type { BookCount, VaultState } from './vault-state';

export interface CountingParts {
  readonly page: PageView;
  note(): OpenNote;
  readonly state: VaultState;
  tell(message: string): void;
}

export interface Counting {
  readonly counters: Counters;
  /** The open note, or the vault, changed: its book is read again. */
  sync(): Promise<void>;
  stop(): void;
}

export function counting(parts: CountingParts): Counting {
  const counters = new Counters({ tell: parts.tell });
  parts.page.counters(counters.element);
  let book: BookCount | null = null;
  // The book's words with the open note's as they are now, not as last indexed.
  const show = () =>
    counters.showBook(
      book && {
        words: book.words - book.note + parts.page.words.words,
        ...(book.goal ? { goal: book.goal } : {}),
      },
    );
  parts.page.words.onWrote((added) => counters.wrote(added));
  parts.page.words.onCounted(show);
  let asked = 0;
  return {
    counters,
    async sync() {
      const ask = ++asked;
      const path = parts.note().path;
      const found = path ? await parts.state.bookOf(path) : null;
      if (ask !== asked) return; // a later one is on its way
      book = found;
      show();
    },
    stop: () => counters.stop(),
  };
}
