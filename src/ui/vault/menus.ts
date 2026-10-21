// The choices a note or a folder offers (right-click, the menu key, or
// Shift+F10). Every move a drag makes is here too, for the keyboard.

import { EXPORT_LABELS } from '../../core/export';
import { baseName, parentOf, titleOf } from '../../core/paths';
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

export interface NoteMenu {
  readonly pinned: boolean;
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
  { label: 'Rename', run: note.rename },
  { label: note.pinned ? 'Unpin' : 'Pin', run: () => note.pin(!note.pinned) },
  'separator',
  ...(note.ordered
    ? ([
        { label: 'Move up', run: () => note.nudge(-1) },
        { label: 'Move down', run: () => note.nudge(1) },
      ] as const)
    : []),
  { label: 'Move to…', run: note.moveTo },
  { label: 'Export…', run: note.exportTo },
  'separator',
  { label: `Move to ${note.trashName}`, run: note.trash },
];

/** The kinds `kinds` offers, as a menu that exports with `run`: a book's leaves out AO3's. */
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
  { label: 'New note here', run: folder.newNote },
  { label: 'New folder inside', run: folder.newFolder },
  'separator',
  { label: 'Rename', run: folder.rename },
  { label: folder.book ? 'Not a book' : 'Make it a book', run: () => folder.setBook(!folder.book) },
  ...(folder.book ? [{ label: 'Word goal…', run: folder.goal }] : []),
  { label: 'Move to…', run: folder.moveTo },
  ...(folder.book ? [{ label: 'Export…', run: folder.exportTo }] : []),
  'separator',
  { label: `Move to ${folder.trashName}`, run: folder.trash },
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
  );
}

export async function showFolderMenu(ctx: MenuContext, path: string, at: At): Promise<void> {
  const settings = (await ctx.state.folderSettings(path)).book;
  openMenu(
    folderMenu({
      book: settings !== null,
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
  );
}
