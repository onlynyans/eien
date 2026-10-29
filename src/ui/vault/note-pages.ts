// The note's kind of page (./page-side.ts), over all its pages at once:
// what it keeps up as every kind does (saves, the disk, moves, its seals),
// and what the window asks of notes alone. Both work over the window's open
// notes (./open-notes.ts), one entry per note however many pages show it,
// and every note's page in the pane; one page made and let go is
// ./note-side.ts's.

import { isInside } from '../../core/paths';
import type { NoteSession } from '../notes/note-session';
import { sealTargetOf } from '../versions/seal-target';
import { isNote, makeNoteSide, type NoteSide, type NoteSideOf } from './note-side';
import type { OpenNotes } from './open-notes';
import type { PageKindOf, Side } from './page-side';

const noteSides = (sides: readonly Side[]): NoteSide[] => sides.filter(isNote);

/** Count what was just written on each of `sides`' notes, now (today's words), without a pause. */
const countWords = (sides: readonly Side[]): void => {
  for (const { page } of noteSides(sides)) page.words.flush();
};

/** The note's kind of page: every file no other kind holds. */
export const noteKind = (of: NoteSideOf, open: OpenNotes): PageKindOf => ({
  kind: 'note',
  holds: () => true,
  make: (hooks, left) => makeNoteSide(of, open, hooks, left),
  async flush(sides) {
    countWords(sides); // before the save's await: counted now, whatever the disk does
    await open.flush(); // every note open, a closed page's still saving included
  },
  diskChanged(changed, sides) {
    open.diskChanged(changed);
    for (const { versions } of noteSides(sides)) void versions.diskChanged(changed); // another device may have sealed one
  },
  followMoves: () => open.followMoves(),
  sync(sides) {
    for (const { versions } of noteSides(sides)) versions.sync();
  },
  stop(sides) {
    for (const { versions } of noteSides(sides)) versions.stop();
  },
});

/** What the window asks of the notes on its pages: the organizer, the counters, Copy as HTML. */
export class NotePages {
  readonly #open: OpenNotes;
  readonly #sides: () => readonly Side[];

  /** `sides`, the pane's pages now, of any kind. */
  constructor(open: OpenNotes, sides: () => readonly Side[]) {
    this.#open = open;
    this.#sides = sides;
  }

  /** Every note open, for the organizer: a move or the trash waits for its words. */
  sessions(): NoteSession[] {
    return this.#open.sessions();
  }

  /** The note open at `path`, whichever page shows it. */
  session(path: string): NoteSession | null {
    return this.#open.session(path);
  }

  /** Hold still (true) or let go (false) the notes' pages showing `path`, or a note in it, while it moves. */
  freeze(path: string, frozen: boolean): void {
    for (const { path: shown, page } of noteSides(this.#sides()))
      if (shown && isInside(shown, path)) page.editor.setLocked(frozen);
  }

  /**
   * Change the words of the note at `path` as Eien's own edit, through a
   * page showing it (as a seal's id is, ../versions), and save it: whether
   * that worked, or null when no page shows it.
   */
  async amendOpen(path: string, change: (text: string) => string): Promise<boolean | null> {
    const side = noteSides(this.#sides()).find((each) => each.path === path);
    return side ? (sealTargetOf(side.note, side.page)?.amend(change, false) ?? null) : null;
  }

  /** Count what was just written on every page, now. */
  flushWords(): void {
    countWords(this.#sides());
  }
}
