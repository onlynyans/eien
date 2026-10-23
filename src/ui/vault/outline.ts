// Outline cards for an open vault (spec §4): the book the active note is a
// chapter of — or, with none open there, the book chosen in the sidebar —
// as cards in the active page's place. A card's chapter opening, another
// note opening on that page, or Esc gives the page back, the keyboard with it.

import type { NumeralStyle } from '../../core/text';
import { OutlineBoard } from '../outline/board';
import type { Board } from '../page/board-host';
import { currentBook, isBook } from './current-book';
import type { Navigation } from './navigation';
import type { Organizer } from './organize';
import type { Side } from './pages';
import type { VaultState } from './vault-state';

export interface OutlineParts {
  /** The active page and its note: the cards lie on it. */
  active(): Pick<Side, 'page' | 'note'>;
  readonly state: VaultState;
  readonly nav: Navigation;
  readonly organizer: Organizer;
  numerals(): NumeralStyle;
  openNote(path: string): Promise<void>;
  /** Run a file operation, then read the vault again (one at a time). */
  act(operation: () => Promise<unknown>): void;
  tell(message: string): void;
}

export interface Outline {
  /** Whether the cards are up. */
  readonly open: boolean;
  /** View → Outline Cards: show the book's cards, or give the page back. */
  toggle(): Promise<void>;
  /** The vault read again, or another note open: the cards drawn again, or gone. */
  sync(): Promise<void>;
}

export function outlineCards(parts: OutlineParts): Outline {
  /** The book shown, the page it lies on, and the note open there (its session) when it was. */
  let shown: {
    readonly folder: string;
    readonly on: Pick<Side, 'page' | 'note'>;
    readonly session: unknown;
  } | null = null;
  /** The page the cards lie on, or the active one when they're down. */
  const page = () => (shown ?? { on: parts.active() }).on.page;
  /** Give the page back (the keyboard with it, if it was on the cards: see `held`). */
  const close = () => page().board.hide();
  const board = new OutlineBoard({
    open: (path) => {
      const on = page();
      on.board.hide();
      void parts.openNote(path).then(() => on.focus());
    },
    placeBefore: (path, before) => parts.act(() => parts.organizer.placeBefore(path, before)),
    moveTo: (path, folder) => parts.act(() => parts.organizer.moveInto(path, folder, true)),
    nudge: (path, by) => parts.act(() => parts.organizer.nudge(path, by)),
    close: () => {
      const on = page();
      on.board.hide();
      on.focus();
    },
  });
  // The page's hold on the cards: it says when it gives the page back (a view chosen, a note shown).
  const held: Board = {
    element: board.element,
    focus: () => board.focus(),
    closed: (hadKeyboard) => {
      const on = page();
      shown = null;
      // Whatever gave the page back finishes first (a note shown, a view chosen); then the keyboard.
      if (hadKeyboard) queueMicrotask(() => on.focus());
    },
  };
  async function draw(): Promise<void> {
    const now = shown;
    if (!now) return;
    // The book gone (renamed, moved, trashed, no longer a book): the page comes back.
    const there = now.folder === '' || parts.state.has(now.folder);
    if (!there || !(await isBook(parts.state, now.folder))) return close();
    const book = await parts.state.notesFor(
      { kind: 'folder', path: now.folder },
      parts.numerals(),
      'order',
    );
    if (shown === now) board.show(book, now.on.note.path);
  }

  return {
    get open() {
      return shown !== null;
    },
    async toggle() {
      if (shown) {
        const on = page();
        on.board.hide();
        on.focus();
        return;
      }
      // The active chapter's book, else the folder chosen when it's a book.
      const on = parts.active();
      const folder = await currentBook(parts.state, parts.nav, on.note.path);
      if (folder === null) {
        parts.tell('Outline cards show a book: choose one, or open one of its chapters.');
        return;
      }
      shown = { folder, on, session: on.note.session };
      on.page.board.show(held);
      await draw();
      board.focus();
    },
    async sync() {
      // Another note open on the cards' page: it's the writer's. The same one renamed or moved keeps the cards.
      const session = shown?.on.note.session;
      if (shown && session && session !== shown.session) close();
      else await draw();
    },
  };
}
