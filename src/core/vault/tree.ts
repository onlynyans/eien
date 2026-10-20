// The folder tree the sidebar shows, built from a vault's entries.

import { baseName, parentOf } from '../paths';
import type { VaultEntry } from './entries';

export interface FolderNode {
  readonly name: string;
  /** Vault-relative; "" for the vault itself. */
  readonly path: string;
  readonly folders: FolderNode[];
  /** Paths of the notes directly inside, by name. */
  readonly notes: string[];
  /** Notes inside, at any depth. */
  noteCount: number;
}

/** Names sorted as people read them: "Chapter 2" before "Chapter 10", case aside. */
export const byName = (a: string, b: string): number =>
  a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });

/**
 * The tree of folders, each with its notes. A note or folder whose parent
 * folder isn't listed is still placed: its missing folders are made.
 */
export function buildTree(entries: readonly VaultEntry[], vaultName: string): FolderNode {
  const root: FolderNode = { name: vaultName, path: '', folders: [], notes: [], noteCount: 0 };
  const folders = new Map<string, FolderNode>([['', root]]);

  const folderAt = (path: string): FolderNode => {
    const known = folders.get(path);
    if (known) return known;
    const node: FolderNode = { name: baseName(path), path, folders: [], notes: [], noteCount: 0 };
    folders.set(path, node);
    folderAt(parentOf(path)).folders.push(node);
    return node;
  };

  for (const entry of entries) {
    if (entry.kind === 'folder') folderAt(entry.path);
    else if (entry.kind === 'note') folderAt(parentOf(entry.path)).notes.push(entry.path);
  }

  const finish = (node: FolderNode): number => {
    node.folders.sort((a, b) => byName(a.name, b.name));
    node.notes.sort((a, b) => byName(baseName(a), baseName(b)));
    node.noteCount =
      node.notes.length + node.folders.reduce((sum, child) => sum + finish(child), 0);
    return node.noteCount;
  };
  finish(root);
  return root;
}
