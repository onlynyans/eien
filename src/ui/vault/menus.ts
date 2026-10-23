// The choices a note or a folder offers (right-click, the menu key, or
// Shift+F10). Every move a drag makes is here too, for the keyboard.

import { EXPORT_LABELS } from '../../core/export';
import { baseName, parentOf, titleOf } from '../../core/paths';
import { type TagNode, tagKey } from '../../core/tags';
import type { FolderNode } from '../../core/vault';
import type { ExportFormat, OutKind } from '../../platform/bridge';
import { askNumber } from '../menu/ask-number';
import { type MenuItem, openMenu } from '../menu/menu';
import type { Exports } from './exports';
import type { Organizer } from './organize';
import type { VaultState } from './vault-state';

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

export const noteMenu = (note: NoteMenu): MenuItem[] => [
  ...(note.openInNewWindow
    ? ([
        { label: 'Open in New Window', icon: 'window', run: note.openInNewWindow },
        'separator',
      ] as const)
    : []),
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
const MAX_GOAL = 10_000_000;

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
export interface MenuContext {
  readonly state: VaultState;
  readonly organizer: Organizer;
  readonly exports: Exports;
  readonly vaultName: string;
  readonly trashName: string;
  /** Run a file operation, then read the vault again and redraw. */
  act(operation: () => Promise<unknown>): void;
  renameNote(path: string): void;
  newNote(folder: string): void;
  newFolder(parent: string): void;
  editFolder(path: string): void;
  /** A folder moved: the open folders and the selection follow it. */
  followFolder(from: string, to: string): void;
  /** A folder went to the trash: if it, or a folder in it, was selected, select All Notes. */
  unselect(path: string): void;
  /** Move a folder in your order, or out of its folder. */
  moveFolder(path: string, how: 'up' | 'down' | 'out'): void;
  /** A note in a window of its own: the desktop's only. */
  readonly openInNewWindow?: (path: string) => void;
}

type At = { readonly x: number; readonly y: number };

/** A note's menu; `ordered` when its row is in its folder's own order, so it can move up or down. */
export function showNoteMenu(ctx: MenuContext, path: string, at: At, ordered: boolean): void {
  const pinned = ctx.state.pins.includes(path);
  const title = titleOf(baseName(path));
  openMenu(
    noteMenu({
      pinned,
      ordered,
      trashName: ctx.trashName,
      openInNewWindow: ctx.openInNewWindow && (() => ctx.openInNewWindow?.(path)),
      rename: () => ctx.renameNote(path),
      pin: (pin) => ctx.act(() => ctx.organizer.pin(path, pin)),
      nudge: (by) => ctx.act(() => ctx.organizer.nudge(path, by)),
      moveTo: () =>
        openMenu(
          destinations(ctx.state.tree, ctx.vaultName, parentOf(path), null, (folder) =>
            ctx.act(() => ctx.organizer.moveInto(path, folder, true)),
          ),
          { at },
          `Move “${title}” to`,
        ),
      exportTo: () =>
        openMenu(
          exportMenu(ctx.exports.kinds, false, (kind) => void ctx.exports.note(path, kind)),
          { at },
          `Export “${title}” as`,
        ),
      trash: () => ctx.act(() => ctx.organizer.trash(path)),
    }),
    { at },
    title,
    true,
  );
}

export async function showFolderMenu(ctx: MenuContext, path: string, at: At): Promise<void> {
  const settings = (await ctx.state.folderSettings(path)).book;
  const beside = ctx.state.folderNames(parentOf(path));
  const place = beside.indexOf(baseName(path));
  openMenu(
    folderMenu({
      book: settings !== null,
      parent: parentOf(path) === '' ? null : baseName(parentOf(path)),
      canUp: place > 0,
      canDown: place >= 0 && place < beside.length - 1,
      move: (how) => ctx.moveFolder(path, how),
      goal: () =>
        void askNumber({
          label: `Word goal for ${baseName(path)}`,
          value: settings?.goal,
          max: MAX_GOAL,
          place: { at },
        }).then((goal) => {
          if (goal !== undefined) ctx.act(() => ctx.organizer.setGoal(path, goal));
        }),
      trashName: ctx.trashName,
      newNote: () => ctx.newNote(path),
      newFolder: () => ctx.newFolder(path),
      rename: () => ctx.editFolder(path),
      setBook: (on) => ctx.act(() => ctx.organizer.setBook(path, on)),
      moveTo: () =>
        openMenu(
          destinations(ctx.state.tree, ctx.vaultName, parentOf(path), path, (folder) =>
            ctx.act(async () => {
              const to = await ctx.organizer.moveInto(path, folder, false);
              if (to) ctx.followFolder(path, to);
            }),
          ),
          { at },
          `Move “${baseName(path)}” to`,
        ),
      exportTo: () =>
        openMenu(
          exportMenu(
            ctx.exports.kinds,
            true,
            (kind) => void ctx.exports.book(path, kind as ExportFormat),
          ),
          { at },
          `Export “${baseName(path)}” as`,
        ),
      trash: () =>
        ctx.act(async () => {
          if (await ctx.organizer.trash(path)) ctx.unselect(path);
        }),
    }),
    { at },
    baseName(path),
    true,
  );
}

/**
 * A tag's menu. A tag made with the + that no note carries yet can be taken
 * back out (it's only in .eien/tags.json; no words are touched). A tag notes
 * carry has no menu yet: renaming one everywhere is still to be designed.
 */
export function showTagMenu(ctx: MenuContext, key: string, at: At): void {
  const made = ctx.state.made.find((tag) => tagKey(tag) === key);
  const node = findTag(ctx.state.tags, key);
  if (!made || !node || node.count > 0) return;
  openMenu(
    [
      {
        label: 'Remove this tag',
        icon: 'close',
        run: () => ctx.act(() => ctx.organizer.makeTag(made, false)),
      },
    ],
    { at },
    `#${node.tag}`,
    true,
  );
}

function findTag(nodes: readonly TagNode[], key: string): TagNode | undefined {
  for (const node of nodes) {
    if (node.key === key) return node;
    const inner = findTag(node.children, key);
    if (inner) return inner;
  }
  return undefined;
}
