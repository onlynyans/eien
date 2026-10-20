// What a note's row does, in the list or in the sidebar's tree: a click
// opens the note; right-click or the menu key (Shift+F10) gives its menu;
// F2 renames it; ⌘⌫ (Ctrl+Delete) sends it to the trash; in a folder's own
// order, Alt+↑/↓ moves it.

import type { Props } from '../dom';

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface RowActions {
  open(path: string): void;
  /** The row's menu, at the pointer or the row; `ordered` when the row is in its folder's own order. */
  menu(path: string, at: Point, ordered: boolean): void;
  rename(path: string): void;
  trash(path: string): void;
  /** One place up or down, in a folder's own order. */
  nudge?(path: string, by: -1 | 1): void;
}

const isMac = /Mac|iPhone|iPad/.test(navigator.platform);

/** Where a menu opens: at the pointer, or, from the keyboard (no pointer), under the row's start. */
export function menuPoint(event: MouseEvent | KeyboardEvent): Point {
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  const fromKeys = !('clientX' in event) || (event.clientX === 0 && event.clientY === 0);
  return fromKeys ? { x: rect.left + 16, y: rect.bottom } : { x: event.clientX, y: event.clientY };
}

/** The menu key, or Shift+F10. */
export const isMenuKey = (event: KeyboardEvent): boolean =>
  event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10');

/** The keys a row answers to, for aria-keyshortcuts. */
export const rowKeys = (ordered: boolean): string =>
  ordered ? 'Alt+ArrowUp Alt+ArrowDown F2' : 'F2';

/** A note row's listeners. */
export function rowEvents(path: string, actions: RowActions, ordered: boolean): Props['on'] {
  return {
    click: () => actions.open(path),
    contextmenu: (event) => {
      event.preventDefault();
      actions.menu(path, menuPoint(event), ordered);
    },
    keydown: (event) => {
      const mod = isMac ? event.metaKey : event.ctrlKey;
      if (isMenuKey(event)) actions.menu(path, menuPoint(event), ordered);
      else if (event.key === 'F2') actions.rename(path);
      else if (mod && (event.key === 'Backspace' || event.key === 'Delete')) actions.trash(path);
      else if (ordered && event.altKey && event.key === 'ArrowUp') actions.nudge?.(path, -1);
      else if (ordered && event.altKey && event.key === 'ArrowDown') actions.nudge?.(path, 1);
      else return;
      event.preventDefault();
    },
  };
}
