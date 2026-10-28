// What a note's row does in a shown vault, in the list and the tree alike,
// and what the menus a row, a folder or a tag opens act with (./menus.ts).

import type { RowActions } from '../list/row-events';
import type { Exports } from './exports';
import { type MenuContext, showNoteMenu } from './menus';
import type { Navigation } from './navigation';
import type { NoteActions } from './note-actions';
import type { orderActions } from './order-actions';
import type { Organizer } from './organize';
import type { Selection, VaultState } from './vault-state';

export interface RowActionsOf {
  readonly state: VaultState;
  readonly organizer: Organizer;
  readonly nav: Navigation;
  readonly order: ReturnType<typeof orderActions>;
  readonly vaultName: string;
  readonly trashName: string;
  /** A note in a window of its own: the desktop's only. */
  readonly openInNewWindow?: (path: string) => void;
  /** Whether a second page may open (not one page at a time, the phone's way: ../phone/room.ts). */
  splits(): boolean;
  /** Made after the rows, whose panes they need. */
  actions(): NoteActions;
  exports(): Exports;
  choose(next: Selection): void;
  /** Run a file operation, then read the vault again (one at a time). */
  act(operation: () => Promise<unknown>): Promise<void>;
}

export function rowActions(of: RowActionsOf): {
  readonly rows: RowActions;
  readonly menus: MenuContext;
} {
  const { state, organizer, order } = of;
  const act = (operation: () => Promise<unknown>) => void of.act(operation);
  const beside = (path: string) => void of.actions().openNote(path, 'beside');
  const menus: MenuContext = {
    state,
    organizer,
    get exports() {
      return of.exports();
    },
    vaultName: of.vaultName,
    trashName: of.trashName,
    openInNewWindow: of.openInNewWindow,
    get openBeside() {
      return of.splits() ? beside : undefined;
    },
    act,
    renameNote: (path) => of.actions().renameNote(path),
    newNote: (folder) => {
      of.choose({ kind: 'folder', path: folder });
      void of.actions().newNote(folder);
    },
    newFolder: (parent) => void of.actions().newFolder(parent),
    editFolder: (path) => of.actions().editFolder(path),
    followFolder: (from, to) => of.nav.follow(from, to),
    unselect: (path) => of.nav.unselect(path),
    moveFolder: (path, how) => order.moveFolder(path, how),
  };
  const rows: RowActions = {
    open: (path) => void of.actions().openNote(path, 'chosen'),
    openBeside: beside,
    menu: (path, at, ordered) => showNoteMenu(menus, path, at, ordered),
    nudge: (path, by) => order.nudgeNote(path, by),
    rename: (path) => of.actions().renameNote(path),
    pin: (path) => act(() => organizer.pin(path, !state.pins.includes(path))),
    trash: (path) => act(() => organizer.trash(path)),
  };
  return { rows, menus };
}
