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
  const counters = new Counters({
    tell: parts.tell,
    flushWriting: () => parts.page.words.flush(),
  });
  parts.page.counters(counters.element);
  /** The open note's book, and the note it was read for. */
  let book: { readonly path: string; readonly count: BookCount } | null = null;
  // The book's words with the open note's as they are now, not as last indexed; none while
  // another note is open than the one the book was read for (until it's read for that one).
  const show = () => {
    const count = book && book.path === parts.note().path ? book.count : null;
    counters.showBook(
      count && {
        words: count.words - count.note + parts.page.words.words,
        ...(count.goal ? { goal: count.goal } : {}),
      },
    );
  };
  parts.page.words.onWrote((added, when) => counters.wrote(added, when));
  parts.page.words.onCounted(show);
  let asked = 0;
  return {
    counters,
    async sync() {
      const ask = ++asked;
      const path = parts.note().path;
      const found = path ? await parts.state.bookOf(path) : null;
      if (ask !== asked) return; // a later one is on its way
      book = path && found ? { path, count: found } : null;
      show();
    },
    stop: () => counters.stop(),
  };
}
