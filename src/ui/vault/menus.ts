// A note's, a book's (#40), a folder's and a tag's menu (right-click, the menu key, or
// Shift+F10), opened where it was asked for, and what each choice does; the
// choices themselves are ./menu-items.ts. Every move a drag makes is here
// too, for the keyboard.

import { baseName, parentOf, titleOf } from '../../core/paths';
import { type TagNode, tagKey } from '../../core/tags';
import { epubTitleOf } from '../../core/vault';
import type { ExportFormat } from '../../platform/bridge';
import { askNumber } from '../menu/ask-number';
import { openMenu } from '../menu/menu';
import type { FolderSection } from '../sidebar/folds';
import type { Exports } from './exports';
import { shownBeside } from './folder-order';
import { destinations, epubMenu, exportMenu, folderMenu, noteMenu } from './menu-items';
import type { Organizer } from './organize';
import type { VaultState } from './vault-state';

/** A book's word goal, at most. */
const MAX_GOAL = 10_000_000;

export interface MenuContext {
  readonly state: VaultState;
  readonly organizer: Organizer;
  readonly exports: Exports;
  readonly vaultName: string;
  readonly trashName: string;
  /** Run a file operation, then read the vault again and redraw. */
  act(operation: () => Promise<unknown>): void;
  renameNote(path: string): void;
  /** A book renamed in its row on SHELF. */
  renameEpub(path: string): void;
  newNote(folder: string): void;
  newFolder(parent: string): void;
  editFolder(path: string): void;
  /** A folder moved: the open folders and the selection follow it, and the keyboard goes with it. */
  followFolder(from: string, to: string): void;
  /** A folder (or a book) went to the trash: if it, or a folder in it, was selected, select All Notes. */
  unselect(path: string): void;
  /** Move a folder in your order among the folders `section` shows beside it, or out of its folder. */
  moveFolder(path: string, how: 'up' | 'down' | 'out', section: FolderSection): void;
  /** A note in a window of its own: the desktop's only. */
  readonly openInNewWindow?: (path: string) => void;
  /** A note on a page beside the open one: the desktop's only, and not in a phone's layout. */
  readonly openBeside?: (path: string) => void;
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
      openBeside: ctx.openBeside && (() => ctx.openBeside?.(path)),
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

/**
 * A book's menu on SHELF (#40): renamed, moved and trashed as a note is. Its reading place is kept
 * by what the book holds, not where it is, so it goes where the book goes.
 */
export function showEpubMenu(ctx: MenuContext, path: string, at: At): void {
  const title = epubTitleOf(baseName(path));
  openMenu(
    epubMenu({
      trashName: ctx.trashName,
      rename: () => ctx.renameEpub(path),
      moveTo: () =>
        openMenu(
          destinations(ctx.state.tree, ctx.vaultName, parentOf(path), null, (folder) =>
            ctx.act(() => ctx.organizer.moveInto(path, folder, true)),
          ),
          { at },
          `Move “${title}” to`,
        ),
      trash: () => trashEpub(ctx, path),
    }),
    { at },
    title,
    true,
  );
}

/** A book to the trash, as a note goes (the writer told where); the list shows notes again if it showed its contents. */
export const trashEpub = (ctx: MenuContext, path: string): void =>
  ctx.act(async () => {
    if (await ctx.organizer.trash(path)) ctx.unselect(path);
  });

/** A folder's menu, from its row in FOLDERS or on SHELF (#40): it moves up and down among the folders shown there. */
export async function showFolderMenu(
  ctx: MenuContext,
  path: string,
  at: At,
  section: FolderSection,
): Promise<void> {
  const settings = (await ctx.state.folderSettings(path)).book;
  const beside = shownBeside(ctx.state, path, section);
  const place = beside.indexOf(baseName(path));
  openMenu(
    folderMenu({
      book: settings !== null,
      parent: parentOf(path) === '' ? null : baseName(parentOf(path)),
      canUp: place > 0,
      canDown: place >= 0 && place < beside.length - 1,
      move: (how) => ctx.moveFolder(path, how, section),
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
