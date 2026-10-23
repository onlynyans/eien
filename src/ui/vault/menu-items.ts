// What a note's and a folder's menus offer, as lists of choices (../menu/menu.ts):
// pure, so each can be read and tested apart from where it opens (./menus.ts).

import { EXPORT_LABELS } from '../../core/export';
import type { FolderNode } from '../../core/vault';
import type { OutKind } from '../../platform/bridge';
import type { MenuItem } from '../menu/menu';

/**
 * Where a trashed note goes, as the writer finds it: the system's trash, or on a phone, which
 * has none, the vault's own (.eien/trash, where any device can take it back).
 */
const TRASH_NAMES: Record<string, string> = {
  win32: 'the Recycle Bin',
  android: '.eien/trash',
  ios: '.eien/trash',
};

export const trashNameOn = (platform: string): string => TRASH_NAMES[platform] ?? 'the trash';

/** The trash's key on a row: ⌘⌫ on a Mac, Ctrl+Delete elsewhere (./row-events.ts takes either). */
const TRASH_KEY = /Mac|iPhone|iPad/.test(navigator.platform) ? 'Mod-Backspace' : 'Mod-Delete';
/** Pin or unpin a focused row. */
const PIN_KEY = 'Mod-Shift-p';

export interface NoteMenu {
  readonly pinned: boolean;
  /** Open to the Side: the desktop's only (a phone shows one page). */
  openBeside?(): void;
  /** Open in New Window: the desktop's only (a phone has one window). */
  openInNewWindow?(): void;
  /** The note can move up or down: the list is in its folder's own order. */
  readonly ordered: boolean;
  readonly trashName: string;
  rename(): void;
  pin(pinned: boolean): void;
  nudge(by: -1 | 1): void;
  moveTo(): void;
  /** Export… : the note as a file (spec §8). */
  exportTo(): void;
  trash(): void;
}

export const noteMenu = (note: NoteMenu): MenuItem[] => {
  const opens: MenuItem[] = [
    ...(note.openBeside
      ? [
          {
            label: 'Open to the Side',
            icon: 'split',
            keys: 'Mod-Enter',
            run: note.openBeside,
          } as const,
        ]
      : []),
    ...(note.openInNewWindow
      ? [{ label: 'Open in New Window', icon: 'window', run: note.openInNewWindow } as const]
      : []),
  ];
  return [
    ...(opens.length > 0 ? [...opens, 'separator' as const] : []),
    { label: 'Rename', icon: 'rename', keys: 'F2', run: note.rename },
    {
      label: note.pinned ? 'Unpin' : 'Pin',
      icon: 'pin',
      keys: PIN_KEY,
      run: () => note.pin(!note.pinned),
    },
    'separator',
    ...(note.ordered
      ? ([
          { label: 'Move up', icon: 'up', keys: 'Alt-ArrowUp', run: () => note.nudge(-1) },
          { label: 'Move down', icon: 'down', keys: 'Alt-ArrowDown', run: () => note.nudge(1) },
        ] as const)
      : []),
    { label: 'Move to…', icon: 'move', run: note.moveTo },
    { label: 'Export…', icon: 'link', run: note.exportTo },
    'separator',
    {
      label: `Move to ${note.trashName}`,
      icon: 'trash',
      keys: TRASH_KEY,
      danger: true,
      run: note.trash,
    },
  ];
};

/** The kinds `kinds` offers, as a menu that exports with `run`: a book's leaves out plain HTML. */
export const exportMenu = (
  kinds: readonly OutKind[],
  book: boolean,
  run: (kind: OutKind) => void,
): MenuItem[] =>
  kinds
    .filter((kind) => !book || kind !== 'html')
    .map((kind) => ({ label: EXPORT_LABELS[kind], run: () => run(kind) }));

/** The most words a goal may be: more than any book. */

export interface FolderMenu {
  readonly book: boolean;
  /** The folder it's in, by name; null at the top. */
  readonly parent: string | null;
  /** Where it can move among the folders beside it. */
  readonly canUp: boolean;
  readonly canDown: boolean;
  move(how: 'up' | 'down' | 'out'): void;
  /** A book's word goal: asked for in a small field. */
  goal(): void;
  readonly trashName: string;
  newNote(): void;
  newFolder(): void;
  rename(): void;
  setBook(book: boolean): void;
  moveTo(): void;
  /** A book's Export… (spec §8). */
  exportTo(): void;
  trash(): void;
}

export const folderMenu = (folder: FolderMenu): MenuItem[] => [
  { label: 'New note here', icon: 'plus', run: folder.newNote },
  { label: 'New folder inside', icon: 'folder', run: folder.newFolder },
  'separator',
  { label: 'Rename', icon: 'rename', keys: 'F2', run: folder.rename },
  {
    label: folder.book ? 'Not a book' : 'Make it a book',
    icon: 'numbers',
    run: () => folder.setBook(!folder.book),
  },
  ...(folder.book ? [{ label: 'Word goal…', icon: 'check', run: folder.goal } as const] : []),
  'separator',
  ...(folder.canUp
    ? [{ label: 'Move up', icon: 'up', keys: 'Alt-ArrowUp', run: () => folder.move('up') } as const]
    : []),
  ...(folder.canDown
    ? [
        {
          label: 'Move down',
          icon: 'down',
          keys: 'Alt-ArrowDown',
          run: () => folder.move('down'),
        } as const,
      ]
    : []),
  ...(folder.parent !== null
    ? [
        {
          label: `Move out of ${folder.parent}`,
          icon: 'outdent',
          keys: 'Alt-ArrowLeft',
          run: () => folder.move('out'),
        } as const,
      ]
    : []),
  { label: 'Move to…', icon: 'move', run: folder.moveTo },
  ...(folder.book ? [{ label: 'Export…', icon: 'link', run: folder.exportTo } as const] : []),
  'separator',
  {
    label: `Move to ${folder.trashName}`,
    icon: 'trash',
    keys: TRASH_KEY,
    danger: true,
    run: folder.trash,
  },
];

/**
 * Where something can be moved: the vault itself, then every folder, nested.
 * `here` (where it is now) and `exclude` (a folder and all in it) can't be chosen.
 */
export function destinations(
  tree: FolderNode,
  vaultName: string,
  here: string,
  exclude: string | null,
  choose: (folder: string) => void,
): MenuItem[] {
  const items: MenuItem[] = [{ label: vaultName, run: () => choose(''), disabled: here === '' }];
  const walk = (node: FolderNode, depth: number) => {
    for (const folder of node.folders) {
      const out =
        exclude !== null && (folder.path === exclude || folder.path.startsWith(`${exclude}/`));
      if (out) continue;
      items.push({
        label: folder.name,
        run: () => choose(folder.path),
        disabled: folder.path === here,
        depth,
      });
      walk(folder, depth + 1);
    }
  };
  walk(tree, 1);
  return items;
}

/** What the menus act on: the vault view's state and its ways of acting. */
