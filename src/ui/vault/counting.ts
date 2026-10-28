// The colophon's counters for an open vault (spec §4): the writer's words, on
// any page, go to today's tally and a sprint (../counters); the active note's
// book shows its words — the note's own counted live — and its goal.

import { Counters } from '../counters/counters';
import type { PagePane } from '../page/page-pane';
import type { Written } from '../page/word-count';
import type { NoteSide } from './pages';
import type { BookCount, VaultState } from './vault-state';

export interface CountingParts {
  readonly pane: PagePane;
  /** The active page and its note, or null when it holds something else. */
  active(): NoteSide | null;
  /** Count what was just written on every page, now. */
  flushWords(): void;
  readonly state: VaultState;
  tell(message: string): void;
}

export interface Counting {
  readonly counters: Counters;
  /** Words the writer added on a page. */
  wrote(added: number, when: Written): void;
  /** A page's words counted again: the book's total moves with the active note's. */
  counted(): void;
  /** The open note, or the vault, changed: its book is read again. */
  sync(): Promise<void>;
  stop(): void;
}

export function counting(parts: CountingParts): Counting {
  const counters = new Counters({ tell: parts.tell, flushWriting: parts.flushWords });
  parts.pane.counters(counters.element);
  /** The active note's book, and the note it was read for. */
  let book: { readonly path: string; readonly count: BookCount } | null = null;
  // The book's words with the active note's as they are now, not as last indexed; none while
  // another note is active than the one the book was read for (until it's read for that one).
  const counted = () => {
    const on = parts.active();
    const count = on && book && book.path === on.note.path ? book.count : null;
    counters.showBook(
      on &&
        count && {
          words: count.words - count.note + on.page.words.words,
          ...(count.goal ? { goal: count.goal } : {}),
        },
    );
  };
  let asked = 0;
  return {
    counters,
    wrote: (added, when) => counters.wrote(added, when),
    counted,
    async sync() {
      const ask = ++asked;
      const path = parts.active()?.note.path ?? null;
      const found = path ? await parts.state.bookOf(path) : null;
      if (ask !== asked) return; // a later one is on its way
      book = path && found ? { path, count: found } : null;
      counted();
    },
    stop: () => counters.stop(),
  };
}
