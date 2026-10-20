// The vault as the window knows it: its files, its folder and tag trees,
// and the notes for whatever is selected in the sidebar or searched for.

import type { IndexedNote } from '../../core/note';
import { baseName, joinPath, nameKey, parentOf, titleOf, VAULT_PINS } from '../../core/paths';
import { buildTagTree, hasTag, type TagNode } from '../../core/tags';
import { chapterNumber, type NumeralStyle } from '../../core/text';
import {
  buildTree,
  byName,
  FOLDER_SETTINGS_NAME,
  type FolderNode,
  type FolderSettings,
  isSyncConflictName,
  orderNames,
  parseFolderSettings,
  parsePins,
  type VaultEntry,
} from '../../core/vault';
import type { VaultBridge } from '../../platform/bridge';

export type Selection =
  | { readonly kind: 'all' }
  | { readonly kind: 'pinned' }
  | { readonly kind: 'folder'; readonly path: string }
  | { readonly kind: 'tag'; readonly key: string };

/** How a list is sorted: its own order (a folder's, or the pins'), by title, or newest first. */
export type NoteSort = 'order' | 'title' | 'modified';

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
  /** What the list is: the library, the pins, a folder, a book, a tag, or a search. */
  readonly kind: 'all' | 'pinned' | 'folder' | 'book' | 'tag' | 'search';
  readonly heading: string;
  readonly notes: readonly ListedNote[];
  /** How many there are; for a search, more than are listed when it hit the limit. */
  readonly total: number;
  /** How it's sorted, and the sorts it offers (none for a search). */
  readonly sort?: NoteSort;
  readonly sorts: readonly NoteSort[];
  /** A folder's path, when it shows one: where its rows can be dragged into order. */
  readonly folder?: string;
}

/** A book's words, as the index has them. */
export interface BookCount {
  readonly words: number;
  /** The words of the note asked about, counted in `words`. */
  readonly note: number;
  readonly goal?: number;
}

type VaultReader = Pick<VaultBridge, 'list' | 'notes' | 'read' | 'search'>;

export class VaultState {
  readonly name: string;
  #entries: VaultEntry[] = [];
  #notes = new Map<string, IndexedNote>();
  #tree: FolderNode;
  #tags: readonly TagNode[] = [];
  #pins: readonly string[] = [];
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

  /** The pinned notes that are there, in the order they were pinned. */
  get pins(): readonly string[] {
    return this.#pins.filter((path) => this.#notes.has(path));
  }

  async refresh(): Promise<void> {
    const [entries, notes, pins] = await Promise.all([
      this.#vault.list(),
      this.#vault.notes(),
      this.#vault.read(VAULT_PINS).catch(() => null),
    ]);
    this.#entries = entries;
    this.#notes = new Map(notes.map((note) => [note.path, note]));
    this.#tree = buildTree(entries, this.name);
    this.#tags = buildTagTree(notes);
    this.#pins = parsePins(pins?.text ?? null);
  }

  /** A folder's own settings: its order, and whether it's a book. */
  async folderSettings(folder: string): Promise<FolderSettings> {
    const file = await this.#vault.read(joinPath(folder, FOLDER_SETTINGS_NAME)).catch(() => null);
    return parseFolderSettings(file?.text ?? null);
  }

  /**
   * The book the note at `path` is a chapter of (its folder, when that's a
   * book): its words, the note's own among them as last indexed, and its goal.
   */
  async bookOf(path: string): Promise<BookCount | null> {
    const folder = parentOf(path);
    const { book } = await this.folderSettings(folder);
    if (!book) return null;
    const notes = findFolder(this.#tree, folder)?.notes ?? [];
    const wordsOf = (note: string) => this.#notes.get(note)?.words ?? 0;
    return {
      words: notes.reduce((sum, note) => sum + wordsOf(note), 0),
      note: wordsOf(path),
      ...(book.goal ? { goal: book.goal } : {}),
    };
  }

  /** The names of a folder's notes, in its own order. */
  async folderOrder(folder: string): Promise<string[]> {
    const node = findFolder(this.#tree, folder);
    return orderNames((node?.notes ?? []).map(baseName), (await this.folderSettings(folder)).order);
  }

  /**
   * The notes whose front matter holds `id`: one, unless a note was copied
   * with its id. Syncthing's conflict copies aren't counted: the note they're
   * beside keeps its id, and its history isn't split between two devices.
   */
  notesWithId(id: string): string[] {
    return [...this.#notes.values()]
      .filter((note) => note.id === id && !isSyncConflictName(baseName(note.path)))
      .map((note) => note.path);
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
    // Compared as file names are: case and Unicode form aside ("Café" typed, "Cafe\u0301" on disk).
    const wanted = nameKey(title.trim());
    const match = this.#entries
      .filter((entry) => entry.kind === 'note')
      .map((entry) => entry.path)
      .sort()
      .find((path) => nameKey(titleOf(baseName(path))) === wanted);
    return match ?? null;
  }

  has(path: string): boolean {
    return this.#entries.some((entry) => entry.path === path);
  }

  /**
   * The notes to list for `selection`, sorted by `sort` (else the list's own
   * default); a book's numbered in `numerals`, by the book's order however
   * the list is sorted.
   */
  async notesFor(
    selection: Selection,
    numerals: NumeralStyle = 'roman',
    sort?: NoteSort,
  ): Promise<NoteList> {
    const sorted = (notes: ListedNote[], by: NoteSort) => {
      if (by === 'title') return notes.sort((a, b) => byName(a.title, b.title));
      if (by === 'modified')
        return notes.sort((a, b) => b.modified - a.modified || (a.path < b.path ? -1 : 1));
      return notes;
    };
    const listed = (paths: Iterable<string>) => [...paths].map((path) => this.#listed(path));

    if (selection.kind === 'all') {
      const by = sort === 'title' ? 'title' : 'modified';
      const notes = sorted(listed(this.#notes.keys()), by);
      return {
        kind: 'all',
        heading: 'All Notes',
        notes,
        total: notes.length,
        sort: by,
        sorts: ['title', 'modified'],
      };
    }
    if (selection.kind === 'pinned') {
      const by = sort ?? 'order';
      const notes = sorted(listed(this.pins), by);
      return {
        kind: 'pinned',
        heading: 'Pinned',
        notes,
        total: notes.length,
        sort: by,
        sorts: ['order', 'title', 'modified'],
      };
    }
    if (selection.kind === 'tag') {
      const by = sort === 'title' ? 'title' : 'modified';
      const tagged = [...this.#notes.values()].filter((note) => hasTag(note.tags, selection.key));
      const notes = sorted(listed(tagged.map((note) => note.path)), by);
      const heading = `#${this.#tagNamed(selection.key)}`;
      return {
        kind: 'tag',
        heading,
        notes,
        total: notes.length,
        sort: by,
        sorts: ['title', 'modified'],
      };
    }

    const folder = findFolder(this.#tree, selection.path) ?? this.#tree;
    const settings = await this.folderSettings(folder.path);
    const book = settings.book !== null;
    const names = orderNames(folder.notes.map(baseName), settings.order);
    // A book, or a folder put in order by hand, opens in its own order.
    const by = sort ?? (book || settings.order.length > 0 ? 'order' : 'modified');
    const notes = sorted(
      names.map((name, i) =>
        this.#listed(
          joinPath(folder.path, name),
          book ? chapterNumber(i + 1, numerals) : undefined,
        ),
      ),
      by,
    );
    return {
      kind: book ? 'book' : 'folder',
      heading: folder.name,
      notes,
      total: notes.length,
      sort: by,
      sorts: ['order', 'title', 'modified'],
      folder: folder.path,
    };
  }

  /** The notes holding every word of `query`, with the words around the match. */
  async search(query: string): Promise<NoteList> {
    const result = await this.#vault.search(query);
    const notes = result.hits.map((hit) => ({ ...this.#listed(hit.path), preview: hit.snippet }));
    return { kind: 'search', heading: `“${query.trim()}”`, notes, total: result.total, sorts: [] };
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
