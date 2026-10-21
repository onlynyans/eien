// What a folder's or a tag's row answers to in the sidebar's tree, besides a
// click: right-click or the menu key for its menu; F2 renames a folder; ⌥ and
// an arrow move a folder in your order (up, down, out of its folder, into the
// one above), and ⌥↑ ⌥↓ a tag (backlog #12). A note's row is ../list/row-events.ts.

import type { Props } from '../dom';
import { isMenuKey, menuPoint, type Point } from '../list/row-events';

/** Where ⌥ and an arrow move a folder. */
export type FolderMove = 'up' | 'down' | 'out' | 'in';

const FOLDER_KEYS: Record<string, FolderMove> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'out',
  ArrowRight: 'in',
};

/** ⌥ alone, as the moves ask for: not with ⌘ or Ctrl. */
const plainAlt = (event: KeyboardEvent) => event.altKey && !event.metaKey && !event.ctrlKey;

export interface FolderKeys {
  menu(at: Point): void;
  rename(): void;
  move(how: FolderMove): void;
}

/**
 * A folder's own menu and keys. Not a double-click to rename, as a note's
 * name has: a click opens a folder, and the next shuts it.
 */
export const folderRowEvents = (on: FolderKeys): Props['on'] => ({
  contextmenu: (event) => {
    event.preventDefault();
    on.menu(menuPoint(event));
  },
  keydown: (event) => {
    const move = plainAlt(event) ? FOLDER_KEYS[event.key] : undefined;
    if (isMenuKey(event)) on.menu(menuPoint(event));
    else if (event.key === 'F2') on.rename();
    else if (move) on.move(move);
    else return;
    event.preventDefault();
  },
});

export interface TagKeys {
  menu(at: Point): void;
  move(by: -1 | 1): void;
}

/** A tag's menu, and ⌥↑ ⌥↓ to move it among the tags beside it. */
export const tagRowEvents = (on: TagKeys): Props['on'] => ({
  contextmenu: (event) => {
    event.preventDefault();
    on.menu(menuPoint(event));
  },
  keydown: (event) => {
    if (isMenuKey(event)) on.menu(menuPoint(event));
    else if (plainAlt(event) && event.key === 'ArrowUp') on.move(-1);
    else if (plainAlt(event) && event.key === 'ArrowDown') on.move(1);
    else return;
    event.preventDefault();
  },
});
