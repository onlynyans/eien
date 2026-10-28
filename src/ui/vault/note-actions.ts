// What the writer does to notes and folders from any pane, menu or key in a
// shown vault: open a note, make a note or a folder, rename a note (in its
// row, or by the page's title) and a folder (in the sidebar).

import { freeNoteName, joinPath } from '../../core/paths';
import type { VaultBridge } from '../../platform/bridge';
import { opensBeside } from '../phone/room';
import type { PaneLayout } from '../shell/panes';
import type { Sidebar } from '../sidebar/sidebar';
import type { Navigation } from './navigation';
import type { Organizer } from './organize';
import type { Pages } from './pages';
import type { PhoneView } from './phone-view';
import { renameInRow } from './rename-in-row';
import type { VaultState } from './vault-state';

export interface NoteActionsOf {
  readonly vault: VaultBridge;
  readonly state: VaultState;
  readonly nav: Navigation;
  readonly organizer: Organizer;
  readonly pages: Pages;
  readonly phone: PhoneView;
  readonly panes: PaneLayout;
  readonly sidebar: Sidebar;
  /** Run a file operation, then read the vault again (one at a time). */
  act(operation: () => Promise<unknown>): Promise<void>;
  /** Read the vault again, then draw. */
  refresh(): Promise<void>;
  redraw(): Promise<void>;
  /** Say why something wasn't done, where the window says such things. */
  tell(message: string): void;
  /** The key that shuts the sidebar, as this system writes it: what makes room for two pages. */
  readonly sidebarKey: string;
}

/**
 * How a note opens: on the active page, beside it (Open to the Side, a drop past the middle), or
 * chosen from a list, which with Two pages is beside the note you're in (spec §10).
 */
export type Opening = 'here' | 'beside' | 'chosen';

export interface NoteActions {
  /** Show the note at `path` as `how` says (on a phone, the page shown). */
  openNote(path: string, how?: Opening): Promise<void>;
  /** A new note, "Untitled", in `into` (else the folder chosen), open to write in. */
  newNote(into?: string): Promise<void>;
  /** A new folder in `parent`, its name in a field to type over. */
  newFolder(parent: string): Promise<void>;
  /** Rename a folder in place: in the sidebar, opened first if it's shut (a menu can outlive it). */
  editFolder(path: string): void;
  /** Rename in the row the writer is at; on a phone, or with no row in sight, by the page's title. */
  renameNote(path: string): void;
}

export function noteActions(of: NoteActionsOf): NoteActions {
  const { state, nav, pages, phone } = of;

  async function openNote(path: string, how: Opening = 'here'): Promise<void> {
    const asked = how === 'beside';
    if (asked && !pages.split && !roomForTwo()) {
      of.tell(
        `Too narrow for two pages beside the sidebar: shut it (${of.sidebarKey}) to make room.`,
      );
      return;
    }
    // Two pages (Wide screen): the second note chosen opens beside the first. Opened any other
    // way (a link, a card, a rename, a new note), a note stays where it was asked for.
    const second =
      how === 'chosen' && opensBeside(phone.stack.room, pages.split, pages.active.note.path, path);
    const beside = asked || (second && roomForTwo());
    await pages.open(path, beside && phone.stack.splits); // one page, the phone's way
    await of.redraw();
    phone.stack.show('page');
  }

  /**
   * Whether two pages would fit beside each other, the list stepping aside
   * for a mode that has it; a mode that folds, closes or docks always fits.
   * The phone's way, the list lies over the page or beside it, and never steps aside.
   */
  function roomForTwo(): boolean {
    const { mode } = pages;
    if (mode.narrow !== 'wait') return true;
    const aside = mode.listAside && !of.panes.phone ? of.panes.listWidth : 0;
    const room = pages.pane.pagesArea.clientWidth + aside;
    return room >= mode.least;
  }

  async function renameOnPage(path: string): Promise<void> {
    if (pages.active.note.path !== path) await openNote(path);
    else phone.stack.show('page'); // on a phone, from the list: the title's on the page
    pages.active.page.editTitle();
  }

  function editFolder(path: string): void {
    of.panes.open('sidebar');
    of.sidebar.editFolder(path);
  }

  return {
    openNote,
    editFolder,
    async newNote(into) {
      const folder = into ?? nav.folder;
      const path = joinPath(folder, freeNoteName('Untitled', state.namesIn(folder)));
      const created = await of.vault.write(path, '', null);
      if (!created.ok) return; // something took the name meanwhile; the next refresh shows it
      nav.openTo(folder); // with two panes, the new note shows where it was made
      await state.refresh();
      await openNote(path);
      pages.active.page.focus(true); // into the new note, to write
    },
    async newFolder(parent) {
      const path = await of.organizer.newFolder(parent);
      if (!path) return;
      nav.openTo(parent);
      await of.refresh();
      editFolder(path);
    },
    renameNote: (path) =>
      phone.stack.phone
        ? void renameOnPage(path)
        : renameInRow(path, {
            namesIn: (folder) => state.namesIn(folder),
            rename: (from, typed) => of.organizer.renameNote(from, typed),
            act: of.act,
            onPage: (at) => void renameOnPage(at),
          }),
  };
}
