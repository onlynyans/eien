// A folder is in FOLDERS, on SHELF, or in both (#40). The section a folder
// row was last pressed, dragged or given the keyboard in is where its new
// name is typed, and where the keyboard goes back to after a rename or a
// move; when the folder isn't there (a new, empty folder isn't on SHELF; one
// moved may change sides), the other section.

import { type FolderNode, inFolders, onShelf } from '../../core/vault';
import type { Props } from '../dom';
import type { Point } from '../list/row-events';
import { findFolder } from '../vault/vault-state';
import type { FolderSection } from './folds';
import { type FolderMove, folderRowEvents } from './row-keys';
import { shelfKey } from './shelf-rows';
import { keyOf } from './tree';

/** Whether `section` lists the folder. */
export const listsFolder = (section: FolderSection, node: FolderNode): boolean =>
  section === 'shelf' ? onShelf(node) : inFolders(node);

const other = (section: FolderSection): FolderSection =>
  section === 'shelf' ? 'folders' : 'shelf';

/** A folder's row in `section`, by its data-key. */
const rowKey = (section: FolderSection, path: string): string =>
  section === 'shelf' ? shelfKey(path) : keyOf({ kind: 'folder', path });

/** What a folder's menu and keys do, by the sidebar. */
export interface FolderActs {
  menu(path: string, at: Point, section: FolderSection): void;
  rename(path: string): void;
  move(path: string, how: FolderMove, section: FolderSection): void;
}

export class FolderSides {
  /** The section a folder's row was last used in. */
  from: FolderSection = 'folders';

  /** Note the section of each folder row pressed (a drag's start too) or given the keyboard in `tree`. */
  watch(tree: HTMLElement): void {
    const note = (event: Event) => {
      const target = event.target instanceof Element ? event.target : null;
      const key = target?.closest<HTMLElement>('[data-folder][data-key]')?.dataset.key;
      if (key) this.from = key.startsWith('shelf:') ? 'shelf' : 'folders';
    };
    tree.addEventListener('pointerdown', note, true);
    tree.addEventListener('focusin', note);
  }

  /** Where the folder at `path` is renamed: the section asked from if it's there, else the other; FOLDERS for one not drawn yet. */
  where(tree: FolderNode, path: string, from = this.from): FolderSection {
    const node = findFolder(tree, path);
    // Every folder is in one section or both (an empty one in FOLDERS).
    if (!node) return 'folders';
    return listsFolder(from, node) ? from : other(from);
  }

  /** The rows to give the keyboard to, first found: the folder's in `first`, then in the other section. */
  keys(path: string, first = this.from): string[] {
    return [rowKey(first, path), rowKey(other(first), path)];
  }

  /** A folder's own menu and keys in `section` (./row-keys.ts). */
  events(path: string, section: FolderSection, acts: FolderActs): Props['on'] {
    return folderRowEvents({
      menu: (at) => acts.menu(path, at, section),
      rename: () => acts.rename(path),
      move: (how) => acts.move(path, how, section),
    });
  }
}
