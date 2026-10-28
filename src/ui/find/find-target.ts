// What the find bar (./find-bar.ts) searches, kept apart from the bar: a
// note's text through CodeMirror's search (../editor/find.ts), and later a
// book's drawn chapters with a matcher of their own and no Replace (backlog
// #40). The target finds, counts, highlights and replaces; the bar draws the
// fields, the options and the count, and is told when to show and redraw.

import type { FindCount } from '../../core/find';

/** What's typed and pressed in the bar. */
export interface FindQuery {
  readonly search: string;
  readonly replace: string;
  readonly caseSensitive: boolean;
  readonly wholeWord: boolean;
  readonly regexp: boolean;
}

/** What the bar searches: a note's text (../editor/find.ts), later a book's drawn chapters. */
export interface FindTarget {
  /** Show the matches; the target calls the bar's `shown(true)` once they are. */
  open(): void;
  /** Hide them (the bar's `shown(false)`), the keyboard back to the text; false when they weren't shown. */
  close(): boolean;
  /** The words chosen now, which may seed the Find field. */
  chosen(): string;
  /** Whether `query` can be searched: something typed, and a pattern that reads. */
  valid(query: FindQuery): boolean;
  /** The query changed: `narrow`, from the match it's on (a letter typed, an option), so each letter narrows; else as it is. */
  query(query: FindQuery, narrow: boolean): void;
  next(): boolean;
  previous(): boolean;
  /** Which match is chosen, of how many, or a pattern that can't be read. */
  count(): FindCount | 'invalid';
  /** Replacing, where the text can change: without it the bar draws no Replace. */
  readonly replace?: {
    /** The current match replaced, and on to the next. */
    one(): boolean;
    all(): boolean;
    /** Whether the text can't change now (read only): Replace is off. */
    locked(): boolean;
  };
  /** A key in the bar, the target's own keys first (a note's find keymap): whether it took it. */
  key?(event: KeyboardEvent): boolean;
}
