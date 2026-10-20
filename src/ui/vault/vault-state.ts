// The vault as the window knows it: its files, its folder and tag trees,
// and the notes for whatever is selected in the sidebar or searched for.

import type { IndexedNote } from '../../core/note';
import { baseName, joinPath, titleOf } from '../../core/paths';
import { buildTagTree, hasTag, type TagNode } from '../../core/tags';
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
  | { readonly kind: 'folder'; readonly path: string }
  | { readonly kind: 'tag'; readonly key: string };

export interface ListedNote {
  readonly path: string;
  readonly title: string;
  readonly modified: number;
  readonly words: number;
  /** The first words; for a search, the words around the match. */
  readonly preview: string;
  /** In a book folder, the chapter's number: "i", "ii"… */
  readonly ordinal?: string;
}

export interface NoteList {
  /** What the list is: the library, a folder, a book, a tag, or a search. */
  readonly kind: 'all' | 'folder' | 'book' | 'tag' | 'search';
  readonly heading: string;
  readonly notes: readonly ListedNote[];
  /** How many there are; for a search, more than are listed when it hit the limit. */
  readonly total: number;
}

type VaultReader = Pick<VaultBridge, 'list' | 'notes' | 'read' | 'search'>;

export class VaultState {
  readonly name: string;
  #entries: VaultEntry[] = [];
  #notes = new Map<string, IndexedNote>();
  #tree: FolderNode;
  #tags: readonly TagNode[] = [];
  readonly #vault: VaultReader;

  constructor(vault: VaultReader, name: string) {
    this.#vault = vault;
    this.name = name;
    this.#tree = buildTree([], name);
  }

  get tree(): FolderNode {
    return this.#tree;
  }

  get tags(): readonly TagNode[] {
    return this.#tags;
  }

  async refresh(): Promise<void> {
    const [entries, notes] = await Promise.all([this.#vault.list(), this.#vault.notes()]);
    this.#entries = entries;
    this.#notes = new Map(notes.map((note) => [note.path, note]));
    this.#tree = buildTree(entries, this.name);
    this.#tags = buildTagTree(notes);
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
    const newestFirst = (notes: IndexedNote[]) =>
      notes
        .sort((a, b) => b.modified - a.modified || (a.path < b.path ? -1 : 1))
        .map((note) => this.#listed(note.path));

    if (selection.kind === 'all') {
      const notes = newestFirst([...this.#notes.values()]);
      return { kind: 'all', heading: 'All Notes', notes, total: notes.length };
    }
    if (selection.kind === 'tag') {
      const notes = newestFirst(
        [...this.#notes.values()].filter((note) => hasTag(note.tags, selection.key)),
      );
      return {
        kind: 'tag',
        heading: `#${this.#tagNamed(selection.key)}`,
        notes,
        total: notes.length,
      };
    }

    const folder = findFolder(this.#tree, selection.path) ?? this.#tree;
    const settings = parseFolderSettings(
      (await this.#vault.read(joinPath(folder.path, FOLDER_SETTINGS_NAME)).catch(() => null))
        ?.text ?? null,
    );
    const book = settings.book !== null;
    const names = orderNames(folder.notes.map(baseName), settings.order);
    const notes = names.map((name, i) =>
      this.#listed(joinPath(folder.path, name), book ? chapterNumber(i + 1, numerals) : undefined),
    );
    return { kind: book ? 'book' : 'folder', heading: folder.name, notes, total: notes.length };
  }

  /** The notes holding every word of `query`, with the words around the match. */
  async search(query: string): Promise<NoteList> {
    const result = await this.#vault.search(query);
    const notes = result.hits.map((hit) => ({ ...this.#listed(hit.path), preview: hit.snippet }));
    return { kind: 'search', heading: `“${query.trim()}”`, notes, total: result.total };
  }

  #listed(path: string, ordinal?: string): ListedNote {
    const note = this.#notes.get(path);
    return {
      path,
      title: titleOf(baseName(path)),
      modified: note?.modified ?? 0,
      words: note?.words ?? 0,
      preview: note?.preview ?? '',
      ...(ordinal ? { ordinal } : {}),
    };
  }

  /** A tag as first written, from its key; the key itself if it's gone. */
  #tagNamed(key: string): string {
    const find = (nodes: readonly TagNode[]): string | undefined => {
      for (const node of nodes) {
        if (node.key === key) return node.tag;
        const below = key.startsWith(`${node.key}/`) ? find(node.children) : undefined;
        if (below) return below;
      }
      return undefined;
    };
    return find(this.#tags) ?? key;
  }
}

export function findFolder(tree: FolderNode, path: string): FolderNode | undefined {
  if (tree.path === path) return tree;
  for (const child of tree.folders) {
    if (path === child.path || path.startsWith(`${child.path}/`)) return findFolder(child, path);
  }
  return undefined;
}
