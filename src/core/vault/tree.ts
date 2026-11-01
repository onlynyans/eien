// The folder tree the sidebar shows, built from a vault's entries.

import { baseName, parentOf } from '../paths';
import { isAssetsFolder } from './assets';
import type { VaultEntry } from './entries';

export interface FolderNode {
  readonly name: string;
  /** Vault-relative; "" for the vault itself. */
  readonly path: string;
  readonly folders: FolderNode[];
  /** Paths of the notes directly inside, by name. */
  readonly notes: string[];
  /** Paths of the EPUBs directly inside, by name: the shelf's (#40), never a note list's. */
  readonly epubs: string[];
  /** Notes inside, at any depth. */
  noteCount: number;
  /** EPUBs inside, at any depth (#40). */
  epubCount: number;
}

/**
 * Names sorted as people read them: "Chapter 2" before "Chapter 10", case
 * aside. One collator for every comparison: `localeCompare` with options
 * makes one each time, and a vault of thousands of notes is sorted on every save.
 */
export const byName: (a: string, b: string) => number = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base',
}).compare;

/**
 * The tree of folders, each with its notes. A note or folder whose parent
 * folder isn't listed is still placed: its missing folders are made. A
 * note's own folder of images ("Chapter 3.assets", ./assets.ts) isn't shown,
 * nor anything in it.
 */
export function buildTree(entries: readonly VaultEntry[], vaultName: string): FolderNode {
  const root: FolderNode = {
    name: vaultName,
    path: '',
    folders: [],
    notes: [],
    epubs: [],
    noteCount: 0,
    epubCount: 0,
  };
  const folders = new Map<string, FolderNode>([['', root]]);

  const folderAt = (path: string): FolderNode => {
    const known = folders.get(path);
    if (known) return known;
    const node: FolderNode = {
      name: baseName(path),
      path,
      folders: [],
      notes: [],
      epubs: [],
      noteCount: 0,
      epubCount: 0,
    };
    folders.set(path, node);
    folderAt(parentOf(path)).folders.push(node);
    return node;
  };

  const notes = new Set(entries.filter((e) => e.kind === 'note').map((e) => e.path));
  const hidden = entries
    .filter((e) => e.kind === 'folder' && isAssetsFolder(e.path, (path) => notes.has(path)))
    .map((e) => `${e.path}/`);
  const inHidden = (path: string) => hidden.some((folder) => `${path}/`.startsWith(folder));

  for (const entry of entries) {
    if (hidden.length > 0 && inHidden(entry.path)) continue;
    if (entry.kind === 'folder') folderAt(entry.path);
    else if (entry.kind === 'note') folderAt(parentOf(entry.path)).notes.push(entry.path);
    else if (entry.kind === 'epub') folderAt(parentOf(entry.path)).epubs.push(entry.path);
  }

  const finish = (node: FolderNode): void => {
    node.folders.sort((a, b) => byName(a.name, b.name));
    node.notes.sort((a, b) => byName(baseName(a), baseName(b)));
    node.epubs.sort((a, b) => byName(baseName(a), baseName(b)));
    node.noteCount = node.notes.length;
    node.epubCount = node.epubs.length;
    for (const child of node.folders) {
      finish(child);
      node.noteCount += child.noteCount;
      node.epubCount += child.epubCount;
    }
  };
  finish(root);
  return root;
}

/**
 * Whether FOLDERS lists the folder (#40): every folder but those whose
 * contents, at any depth, are EPUBs and nothing else. Judged on the whole
 * subtree, so a folder with a note anywhere under it stays, and so does one
 * holding an empty folder, which always shows: nothing listed is cut off.
 * Empty is what the tree holds: a folder of pictures alone shows.
 */
export const inFolders = (node: FolderNode): boolean =>
  node.noteCount > 0 || node.epubCount === 0 || node.folders.some(inFolders);

/** Whether SHELF lists the folder (#40): an EPUB in it, at any depth. */
export const onShelf = (node: FolderNode): boolean => node.epubCount > 0;
