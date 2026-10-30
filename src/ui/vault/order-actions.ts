// The sidebar's moves in your order (backlog #12): a folder by ⌥ and an
// arrow, its menu or a drag, and a tag by ⌥↑ ⌥↓. Each runs as a file
// operation, then the keyboard goes with what moved, wherever it is now.

import { joinPath, parentOf } from '../../core/paths';
import { FOLDER_SETTINGS_NAME, placedBefore } from '../../core/vault';
import type { FolderSection } from '../sidebar/folds';
import type { FolderMove, Sidebar } from '../sidebar/sidebar';
import {
  dropFolder,
  type FolderDrop,
  folderInto,
  folderOut,
  nudgeFolder,
  tagOrderAfter,
} from './folder-order';
import type { Navigation } from './navigation';
import type { Organizer } from './organize';
import type { VaultState } from './vault-state';

export interface OrderActionsOf {
  readonly state: VaultState;
  readonly organizer: Organizer;
  readonly nav: Navigation;
  readonly sidebar: () => Sidebar;
  /** Run a file operation, then read the vault again and redraw. */
  act(operation: () => Promise<unknown>): Promise<void>;
  /** Draw the sidebar again, with nothing changed on disk. */
  redrawTree(): void;
}

export function orderActions(of: OrderActionsOf) {
  const { state, organizer, nav } = of;
  const act = (operation: () => Promise<unknown>) => of.act(operation);
  const files = { state, organizer };
  /**
   * Where it is now: the keyboard goes there, and the open folders and selection follow it.
   * The folder it's in opens on SHELF too, so it's in sight there as in FOLDERS.
   */
  const land = (path: string, to: string | null) => {
    if (to && to !== path) nav.follow(path, to);
    if (to) nav.shelf.openTo(parentOf(to));
    of.sidebar().refocusOn(to ?? path);
  };
  return {
    land,
    moveFolder(path: string, how: FolderMove, section: FolderSection = 'folders'): void {
      void act(async () => {
        if (how === 'up' || how === 'down') {
          await nudgeFolder(files, path, how === 'up' ? -1 : 1, section);
          land(path, path);
          return;
        }
        const to =
          how === 'out' ? await folderOut(files, path) : await folderInto(files, path, section);
        if (to && how === 'in') nav.openTo(parentOf(to));
        land(path, to);
      });
    },
    dropFolder(path: string, to: FolderDrop): void {
      void act(async () => land(path, await dropFolder(files, path, to)));
    },
    /** A note moved one place in the list showing: All Notes' own order, or its folder's. */
    nudgeNote(path: string, by: -1 | 1): void {
      if (nav.selection.kind !== 'all') {
        void act(() => organizer.nudge(path, by));
        return;
      }
      const shown = state.allOrder();
      const at = shown.indexOf(path);
      if (at < 0 || at + by < 0 || at + by >= shown.length) return;
      [shown[at], shown[at + by]] = [shown[at + by] as string, shown[at] as string];
      void act(() => organizer.setAllOrder(shown));
    },
    /**
     * A note dragged into place in the list showing, before `before` (last, for
     * null). Let go in another group (a subfolder's notes, backlog #42), it
     * moves to that group's folder first: the same move as onto its folder.
     */
    placeNote(path: string, before: string | null, group?: string): void {
      if (nav.selection.kind !== 'all') {
        void act(async () => {
          const into = group ?? parentOf(path);
          const at = await organizer.moveInto(path, into, true);
          if (at === null) return; // it couldn't move: the writer is told why
          if (at !== path) await state.refresh([joinPath(into, FOLDER_SETTINGS_NAME)]);
          await organizer.placeBefore(at, before);
        });
        return;
      }
      void act(() => organizer.setAllOrder(placedBefore(state.allOrder(), path, before)));
    },
    moveTag(key: string, by: -1 | 1): void {
      const order = tagOrderAfter(state.tags, key, by);
      of.sidebar().refocusOn(null, `tag:${key}`);
      if (order) void act(() => organizer.setTagOrder(order));
      else of.redrawTree();
    },
  };
}
