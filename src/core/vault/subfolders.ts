// A folder's list with its subfolders' notes too (backlog #42). Your order
// holds: the folder's own notes first, then each subfolder's, at every depth,
// as a group under its name, the groups in your folder order (each folder
// just before the folders in it), each group in its own order.

import { parentOf } from '../paths';
import type { FolderNode } from './tree';

export interface Subfolder {
  readonly path: string;
  /** Its path below the folder listed, as a group's head reads: "Drafts / Old". */
  readonly name: string;
}

/** Every folder under `node`, at every depth, in your order: each just before the folders in it. */
export function subfoldersOf(node: FolderNode): Subfolder[] {
  const found: Subfolder[] = [];
  const walk = (folder: FolderNode, above: string) => {
    for (const child of folder.folders) {
      const name = above ? `${above} / ${child.name}` : child.name;
      found.push({ path: child.path, name });
      walk(child, name);
    }
  };
  walk(node, '');
  return found;
}

/**
 * `notes` with each folder's together, in the groups' order: the folder's own
 * (any not in a subfolder) first, then each of `subfolders`. Within a folder
 * they keep the order they came in (a search's best first).
 */
export function inGroups<T extends { readonly path: string }>(
  notes: readonly T[],
  subfolders: readonly Subfolder[],
): T[] {
  const at = new Map(subfolders.map((folder, i) => [folder.path, i + 1]));
  const rank = (note: T) => at.get(parentOf(note.path)) ?? 0;
  return notes
    .map((note, i) => ({ note, i, rank: rank(note) }))
    .sort((a, b) => a.rank - b.rank || a.i - b.i)
    .map(({ note }) => note);
}

export type Grouped<T> = { readonly head: Subfolder } | { readonly note: T };

/**
 * The rows to draw for `notes` (in groups, as `inGroups` puts them): a head
 * before each subfolder's first note. The folder's own notes have none, and a
 * subfolder with no notes listed (none, or none that pass a filter) none either.
 */
export function withHeads<T extends { readonly path: string }>(
  notes: readonly T[],
  subfolders: readonly Subfolder[],
): Grouped<T>[] {
  const byPath = new Map(subfolders.map((folder) => [folder.path, folder]));
  const rows: Grouped<T>[] = [];
  let last: string | null = null;
  for (const note of notes) {
    const folder = parentOf(note.path);
    const head = byPath.get(folder);
    if (folder !== last && head) rows.push({ head });
    last = folder;
    rows.push({ note });
  }
  return rows;
}
