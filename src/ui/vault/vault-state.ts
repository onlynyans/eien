// The vault as the window knows it: its files, its tree, and the notes for
// whatever is selected in the sidebar.

import { baseName, joinPath, titleOf } from '../../core/paths';
import { chapterNumber, type NumeralStyle } from '../../core/text';
import {
  buildTree,
  FOLDER_SETTINGS_NAME,
  type FolderNode,
  orderNames,
  parseFolderSettings,
  type VaultEntry,
} from '../../core/vault';
import type { VaultBridge } from '../../platform/bridge';

export type Selection =
  | { readonly kind: 'all' }
  | { readonly kind: 'folder'; readonly path: string };

export interface ListedNote {
  readonly path: string;
  readonly title: string;
  readonly modified: number;
  /** In a book folder, the chapter's number: "i", "ii"… */
  readonly ordinal?: string;
}

export interface NoteList {
  readonly heading: string;
  readonly book: boolean;
  readonly notes: readonly ListedNote[];
}

export class VaultState {
  readonly name: string;
  #entries: VaultEntry[] = [];
  #tree: FolderNode;
  readonly #vault: Pick<VaultBridge, 'list' | 'read'>;

  constructor(vault: Pick<VaultBridge, 'list' | 'read'>, name: string) {
    this.#vault = vault;
    this.name = name;
    this.#tree = buildTree([], name);
  }

  get tree(): FolderNode {
    return this.#tree;
  }

  async refresh(): Promise<void> {
    this.#entries = await this.#vault.list();
    this.#tree = buildTree(this.#entries, this.name);
  }

  /** Names of everything in `folder`, for picking a free name there. */
  namesIn(folder: string): string[] {
    const prefix = folder ? `${folder}/` : '';
    return this.#entries
      .filter(
        (entry) => entry.path.startsWith(prefix) && !entry.path.slice(prefix.length).includes('/'),
      )
      .map((entry) => baseName(entry.path));
  }

  /** The note a [[wiki link]] names: titled `title`, case aside; the first by path if several are. */
  findByTitle(title: string): string | null {
    const wanted = title.trim().toLocaleLowerCase();
    const match = this.#entries
      .filter((entry) => entry.kind === 'note')
      .map((entry) => entry.path)
      .sort()
      .find((path) => titleOf(baseName(path)).toLocaleLowerCase() === wanted);
    return match ?? null;
  }

  has(path: string): boolean {
    return this.#entries.some((entry) => entry.path === path);
  }

  /** The notes to list for `selection`, in their order; a book's numbered in `numerals`. */
  async notesFor(selection: Selection, numerals: NumeralStyle = 'roman'): Promise<NoteList> {
    const modified = new Map(this.#entries.map((entry) => [entry.path, entry.modified]));
    const listed = (path: string, ordinal?: string): ListedNote => ({
      path,
      title: titleOf(baseName(path)),
      modified: modified.get(path) ?? 0,
      ...(ordinal ? { ordinal } : {}),
    });

    if (selection.kind === 'all') {
      const notes = this.#entries
        .filter((entry) => entry.kind === 'note')
        .sort((a, b) => b.modified - a.modified)
        .map((entry) => listed(entry.path));
      return { heading: 'All Notes', book: false, notes };
    }

    const folder = findFolder(this.#tree, selection.path) ?? this.#tree;
    const settings = parseFolderSettings(
      (await this.#vault.read(joinPath(folder.path, FOLDER_SETTINGS_NAME)).catch(() => null))
        ?.text ?? null,
    );
    const book = settings.book !== null;
    const names = orderNames(folder.notes.map(baseName), settings.order);
    const notes = names.map((name, i) =>
      listed(joinPath(folder.path, name), book ? chapterNumber(i + 1, numerals) : undefined),
    );
    return { heading: folder.name, book, notes };
  }
}

export function findFolder(tree: FolderNode, path: string): FolderNode | undefined {
  if (tree.path === path) return tree;
  for (const child of tree.folders) {
    if (path === child.path || path.startsWith(`${child.path}/`)) return findFolder(child, path);
  }
  return undefined;
}
