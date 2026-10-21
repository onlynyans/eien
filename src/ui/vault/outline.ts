// Outline cards for an open vault (spec §4): the book the open note is a
// chapter of — or, with none open there, the book chosen in the sidebar —
// as cards in the sheet's place. A card's chapter opening, another note
// opening, or Esc gives the page back, the keyboard with it.

import type { NumeralStyle } from '../../core/text';
import { OutlineBoard } from '../outline/board';
import type { Board } from '../page/board-host';
import type { PageView } from '../page/page';
import { currentBook, isBook } from './current-book';
import type { Navigation } from './navigation';
import type { OpenNote } from './open-note';
import type { Organizer } from './organize';
import type { VaultState } from './vault-state';

export interface OutlineParts {
  readonly page: PageView;
  readonly state: VaultState;
  readonly nav: Navigation;
  readonly organizer: Organizer;
  note(): OpenNote;
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
  const { page } = parts;
  /** The book shown, and the note open (its session) when it was. */
  let shown: { readonly folder: string; readonly session: unknown } | null = null;
  /** Give the page back (the keyboard with it, if it was on the cards: see `held`). */
  const close = () => page.board.hide();
  const board = new OutlineBoard({
    open: (path) => {
      page.board.hide();
      void parts.openNote(path).then(() => page.focus());
    },
    placeBefore: (path, before) => parts.act(() => parts.organizer.placeBefore(path, before)),
    moveTo: (path, folder) => parts.act(() => parts.organizer.moveInto(path, folder, true)),
    nudge: (path, by) => parts.act(() => parts.organizer.nudge(path, by)),
    close: () => {
      page.board.hide();
      page.focus();
    },
  });
  // The page's hold on the cards: it says when it gives the page back (a view chosen, a note shown).
  const held: Board = {
    element: board.element,
    focus: () => board.focus(),
    closed: (hadKeyboard) => {
      shown = null;
      // Whatever gave the page back finishes first (a note shown, a view chosen); then the keyboard.
      if (hadKeyboard) queueMicrotask(() => page.focus());
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
    if (shown === now) board.show(book, parts.note().path);
  }

  return {
    get open() {
      return shown !== null;
    },
    async toggle() {
      if (shown) {
        page.board.hide();
        page.focus();
        return;
      }
      // The open chapter's book, else the folder chosen when it's a book.
      const folder = await currentBook(parts.state, parts.nav, parts.note().path);
      if (folder === null) {
        parts.tell('Outline cards show a book: choose one, or open one of its chapters.');
        return;
      }
      shown = { folder, session: parts.note().session };
      page.board.show(held);
      await draw();
      board.focus();
    },
    async sync() {
      // Another note open: the page is the writer's. The same one renamed or moved keeps the cards.
      const session = parts.note().session;
      if (shown && session && session !== shown.session) close();
      else await draw();
    },
  };
}
