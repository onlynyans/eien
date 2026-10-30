// Your order for folders (backlog #12, docs/design/explorations/order.md):
// a folder moves up or down among its own (⌥↑ ⌥↓, its menu, a drag), out of
// the folder it's in (⌥←), or into the folder above it (⌥→). Up, down and
// into are among the folders the section it moves in shows (FOLDERS or
// SHELF, #40), stepping over those only the other shows. The order is in
// the parent's .eien-folder.json, the vault's own for the top folders, as a
// folder's notes' order is: written to the vault, so it syncs.

import { baseName, joinPath, parentOf } from '../../core/paths';
import type { TagNode } from '../../core/tags';
import { FOLDER_SETTINGS_NAME, placedBefore } from '../../core/vault';
import { listsFolder } from '../sidebar/folder-sides';
import type { FolderSection } from '../sidebar/folds';
import type { Organizer } from './organize';
import { findFolder, type VaultState } from './vault-state';

export interface FolderOrderOf {
  readonly state: VaultState;
  readonly organizer: Organizer;
}

/** The names of the folder at `path` and those beside it that `section` shows, in your order. */
export function shownBeside(state: VaultState, path: string, section: FolderSection): string[] {
  const folders = findFolder(state.tree, parentOf(path))?.folders ?? [];
  return folders.filter((node) => listsFolder(section, node)).map((node) => node.name);
}

/** One place up or down among the folders `section` shows beside it; false when it's at that end already. */
export function nudgeFolder(
  of: FolderOrderOf,
  path: string,
  by: -1 | 1,
  section: FolderSection,
): Promise<boolean> {
  const parent = parentOf(path);
  const shown = shownBeside(of.state, path, section);
  const at = shown.indexOf(baseName(path));
  const past = shown[at + by];
  if (at < 0 || past === undefined) return Promise.resolve(false);
  // Up: just before the one shown above it; down: just after the one shown below it. A
  // folder the section doesn't show between them keeps its place among the rest.
  const all = of.state.folderNames(parent);
  const before = by < 0 ? past : all[all.indexOf(past) + 1];
  return placeFolderBefore(of, path, before === undefined ? null : joinPath(parent, before));
}

/** Place the folder at `path` just before the folder `before` beside it (last, for null). */
export function placeFolderBefore(
  of: FolderOrderOf,
  path: string,
  before: string | null,
): Promise<boolean> {
  const parent = parentOf(path);
  const shown = of.state.folderNames(parent);
  const order = placedBefore(shown, baseName(path), before === null ? null : baseName(before));
  if (order.join('\n') === shown.join('\n')) return Promise.resolve(true);
  return of.organizer.setOrder(parent, { folders: order });
}

/**
 * Out of the folder it's in, to just after that folder (⌥←); its new path,
 * or null at the top already, or when it couldn't move (the writer is told).
 */
export async function folderOut(of: FolderOrderOf, path: string): Promise<string | null> {
  const parent = parentOf(path);
  if (parent === '') return null;
  const grand = parentOf(parent);
  // Where it goes: after its old folder, so it's beside where it was.
  const after = of.state.folderNames(grand);
  const next = after[after.indexOf(baseName(parent)) + 1];
  const to = await of.organizer.moveInto(path, grand, false);
  if (to === null) return null;
  await of.state.refresh([joinPath(grand, FOLDER_SETTINGS_NAME)]);
  await placeFolderBefore(of, to, next === undefined ? null : joinPath(grand, next));
  return to;
}

/** Into the folder `section` shows just above it, last there (⌥→); its new path, or null with none above. */
export function folderInto(
  of: FolderOrderOf,
  path: string,
  section: FolderSection,
): Promise<string | null> {
  const parent = parentOf(path);
  const shown = shownBeside(of.state, path, section);
  const above = shown[shown.indexOf(baseName(path)) - 1];
  if (above === undefined) return Promise.resolve(null);
  return of.organizer.moveInto(path, joinPath(parent, above), false);
}

/** Where a dragged folder was let go (../sidebar/folder-drag.ts). */
export type FolderDrop =
  | { readonly into: string }
  | { readonly before: string }
  | { readonly after: string }
  | { readonly out: true };

/**
 * A folder let go: inside a folder, beside one (in that one's folder, moving
 * there first when it's elsewhere), or out of its own. Its path after, or
 * null when it didn't move (the writer is told why).
 */
export async function dropFolder(
  of: FolderOrderOf,
  path: string,
  to: FolderDrop,
): Promise<string | null> {
  if ('out' in to) return folderOut(of, path);
  if ('into' in to) return of.organizer.moveInto(path, to.into, false);
  const beside = 'before' in to ? to.before : to.after;
  const parent = parentOf(beside);
  let at: string | null = path;
  if (parentOf(path) !== parent) {
    at = await of.organizer.moveInto(path, parent, false);
    if (at === null) return null;
    await of.state.refresh([joinPath(parent, FOLDER_SETTINGS_NAME)]);
  }
  const names = of.state.folderNames(parent).filter((name) => name !== baseName(at));
  const next = 'before' in to ? baseName(beside) : names[names.indexOf(baseName(beside)) + 1];
  await placeFolderBefore(of, at, next === undefined ? null : joinPath(parent, next));
  return at;
}

/**
 * Every tag's key in your order, after the tag `key` moves one place `by`
 * among the tags beside it (as the tree shows them); null at that end already.
 */
export function tagOrderAfter(tags: readonly TagNode[], key: string, by: -1 | 1): string[] | null {
  let moved = false;
  const walk = (level: readonly TagNode[]): string[] => {
    const keys = level.map((node) => node.key);
    const at = keys.indexOf(key);
    if (at >= 0 && at + by >= 0 && at + by < keys.length) {
      [keys[at], keys[at + by]] = [keys[at + by] as string, keys[at] as string];
      moved = true;
    }
    const byKey = new Map(level.map((node) => [node.key, node]));
    return keys.flatMap((one) => [one, ...walk(byKey.get(one)?.children ?? [])]);
  };
  const order = walk(tags);
  return moved ? order : null;
}
