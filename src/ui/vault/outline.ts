// Outline cards for an open vault (spec §4): the book the open note is a
// chapter of — or, with none open there, the book chosen in the sidebar —
// as cards in the sheet's place. A card's chapter opening, another note
// opening, or Esc gives the page back.

import { parentOf } from '../../core/paths';
import type { NumeralStyle } from '../../core/text';
import { OutlineBoard } from '../outline/board';
import type { PageView } from '../page/page';
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
  openNote(path: string): void;
  /** Run a file operation, then read the vault again (one at a time). */
  act(operation: () => Promise<unknown>): void;
  tell(message: string): void;
}

export interface Outline {
  /** View → Outline Cards: show the book's cards, or give the page back. */
  toggle(): Promise<void>;
  /** The vault read again, or another note open: the cards drawn again, or gone. */
  sync(): Promise<void>;
}

export function outlineCards(parts: OutlineParts): Outline {
  /** The book shown, and the note open when it was. */
  let shown: { readonly folder: string; readonly note: string | null } | null = null;
  const close = () => {
    shown = null;
    parts.page.board(null);
  };
  const board = new OutlineBoard({
    open: (path) => {
      close();
      parts.openNote(path);
    },
    placeBefore: (path, before) => parts.act(() => parts.organizer.placeBefore(path, before)),
    nudge: (path, by) => parts.act(() => parts.organizer.nudge(path, by)),
    close: () => {
      close();
      parts.page.focus();
    },
  });
  const isBook = async (folder: string) => (await parts.state.folderSettings(folder)).book !== null;

  /** The book to show: the open chapter's, else the folder chosen when it's a book. */
  async function bookFolder(): Promise<string | null> {
    const path = parts.note().path;
    if (path && (await isBook(parentOf(path)))) return parentOf(path);
    const chosen = parts.nav.selection;
    return chosen.kind === 'folder' && (await isBook(chosen.path)) ? chosen.path : null;
  }

  async function draw(): Promise<void> {
    const now = shown;
    if (!now) return;
    // The book gone (renamed, moved, trashed, no longer a book): the page comes back.
    if (!parts.state.has(now.folder) || !(await isBook(now.folder))) return close();
    const book = await parts.state.notesFor(
      { kind: 'folder', path: now.folder },
      parts.numerals(),
      'order',
    );
    if (shown === now) board.show(book, parts.note().path);
  }

  return {
    async toggle() {
      if (shown) {
        close();
        parts.page.focus();
        return;
      }
      const folder = await bookFolder();
      if (folder === null) {
        parts.tell('Outline cards show a book: choose one, or open one of its chapters.');
        return;
      }
      shown = { folder, note: parts.note().path };
      parts.page.board(board.element);
      await draw();
      board.focus();
    },
    async sync() {
      if (shown && parts.note().path !== shown.note) close();
      else await draw();
    },
  };
}
