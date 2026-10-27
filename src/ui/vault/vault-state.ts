// The vault as the window knows it: its files, its folder and tag trees,
// and the notes for whatever is selected in the sidebar or searched for.

import type { IndexedNote } from '../../core/note';
import {
  baseName,
  joinPath,
  nameKey,
  parentOf,
  titleOf,
  VAULT_ORDER,
  VAULT_PINS,
  VAULT_TAGS,
} from '../../core/paths';
import {
  buildTagTree,
  filtering,
  hasTag,
  NO_FILTER,
  parseMadeTags,
  parseTagOrder,
  passes,
  type TagFilter,
  type TagNode,
} from '../../core/tags';
import { chapterNumber, type NumeralStyle } from '../../core/text';
import {
  buildTree,
  byName,
  FOLDER_SETTINGS_NAME,
  type FolderNode,
  type FolderSettings,
  inGroups,
  inYourOrder,
  isSyncConflictName,
  NO_FOLDER_SETTINGS,
  orderFolders,
  orderNames,
  parseFolderSettings,
  parsePins,
  type Subfolder,
  subfoldersOf,
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
  /** For a search narrowed to a list's notes, that list's name. */
  readonly within?: string;
  /** The tag filter laid over it, when one is; `of`, how many there were before it. */
  readonly filter?: TagFilter;
  readonly of?: number;
  /**
   * A folder with folders in it: whether its list shows their notes too (the
   * toggle's state; absent where there's no toggle, as for the tree's lists).
   */
  readonly nested?: boolean;
  /** Showing subfolders' notes: the subfolders, in your order, each a group under its name. */
  readonly groups?: readonly Subfolder[];
}

/** A book's words, as the index has them. */
export interface BookCount {
  readonly words: number;
  /** The words of the note asked about, counted in `words`. */
  readonly note: number;
  readonly goal?: number;
}

type VaultSource = Pick<VaultBridge, 'list' | 'notes' | 'read' | 'search'>;

export class VaultState {
  readonly name: string;
  #entries: VaultEntry[] = [];
  #notes = new Map<string, IndexedNote>();
  #tree: FolderNode;
  #tags: readonly TagNode[] = [];
  #pins: readonly string[] = [];
  /** All Notes in your order, as stored (.eien/order.json). */
  #allOrder: readonly string[] = [];
  /** The tags made with the sidebar's +, before any note carries them. */
  #made: readonly string[] = [];
  /** Whether each folder is a book, as its settings last read said (the sidebar's BOOK mark). */
  #settingsOf = new Map<string, FolderSettings>();
  readonly #vault: VaultSource;

  constructor(vault: VaultSource, name: string) {
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

  /** The folders that are books, by path. */
  get books(): ReadonlySet<string> {
    return new Set(
      [...this.#settingsOf]
        .filter(([, settings]) => settings.book !== null)
        .map(([folder]) => folder),
    );
  }

  /** The tags made with the sidebar's + (./organize.ts makeTag), whether notes carry them yet or not. */
  get made(): readonly string[] {
    return this.#made;
  }

  /** The pinned notes that are there, in the order they were pinned. */
  get pins(): readonly string[] {
    return this.#pins.filter((path) => this.#notes.has(path));
  }

  /**
   * Read the vault again. `changed` are the paths the watcher named: a folder
   * whose settings are among them is read again; the rest, only when new.
   */
  async refresh(changed: Iterable<string> = []): Promise<void> {
    const [entries, notes, pins, made, order] = await Promise.all([
      this.#vault.list(),
      this.#vault.notes(),
      this.#vault.read(VAULT_PINS).catch(() => null),
      this.#vault.read(VAULT_TAGS).catch(() => null),
      this.#vault.read(VAULT_ORDER).catch(() => null),
    ]);
    this.#allOrder = parsePins(order?.text ?? null);
    this.#entries = entries;
    this.#notes = new Map(notes.map((note) => [note.path, note]));
    this.#tree = buildTree(entries, this.name);
    this.#made = parseMadeTags(made?.text ?? null);
    this.#tags = buildTagTree(notes, this.#made, parseTagOrder(made?.text ?? null));
    this.#pins = parsePins(pins?.text ?? null);
    await this.#readFolders(changed);
    // Each folder's own folders in the writer's order, the vault's top ones in the vault's.
    orderFolders(this.#tree, (path) => this.#settingsOf.get(path)?.order ?? []);
  }

  /**
   * Every folder's settings (its order, whether it's a book), the vault's own
   * too: read when a folder is new, or its settings changed.
   */
  async #readFolders(changed: Iterable<string>): Promise<void> {
    for (const path of changed) {
      if (baseName(path) === FOLDER_SETTINGS_NAME) this.#settingsOf.delete(parentOf(path));
    }
    const folders: string[] = [''];
    const walk = (node: FolderNode) => {
      for (const folder of node.folders) {
        folders.push(folder.path);
        walk(folder);
      }
    };
    walk(this.#tree);
    const known = new Map(this.#settingsOf);
    await Promise.all(
      folders
        .filter((folder) => !known.has(folder))
        .map(async (folder) => known.set(folder, await this.folderSettings(folder))),
    );
    this.#settingsOf = new Map(
      folders.map((folder) => [folder, known.get(folder) ?? NO_FOLDER_SETTINGS]),
    );
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

  /** Every note's path, in All Notes' own order (your order, new notes first). */
  allOrder(): string[] {
    return inYourOrder([...this.#notes.values()], this.#allOrder).map((note) => note.path);
  }

  /** The names of a folder's own folders, in its order (the vault's top ones for ""). */
  folderNames(folder: string): string[] {
    return (findFolder(this.#tree, folder)?.folders ?? []).map((node) => node.name);
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
   * The notes `selection` lists, sorted by `sort` (else its own), through
   * `filter` if one is laid over it; a book's numbered in `numerals`, by the
   * book's order however the list is sorted. A folder's, with `nested`, has
   * its subfolders' notes too, each folder's a group (backlog #42).
   */
  async notesFor(
    selection: Selection,
    numerals: NumeralStyle = 'roman',
    sort?: NoteSort,
    filter: TagFilter = NO_FILTER,
    nested?: boolean,
  ): Promise<NoteList> {
    const list = await this.#notesFor(selection, numerals, sort, nested);
    if (!filtering(filter)) return list;
    const notes = list.notes.filter((note) =>
      passes(this.#notes.get(note.path)?.tags ?? [], filter),
    );
    return { ...list, notes, total: notes.length, filter, of: list.total };
  }

  async #notesFor(
    selection: Selection,
    numerals: NumeralStyle,
    sort?: NoteSort,
    nested?: boolean,
  ): Promise<NoteList> {
    const sorted = (notes: ListedNote[], by: NoteSort) => {
      if (by === 'title') return notes.sort((a, b) => byName(a.title, b.title));
      if (by === 'modified')
        return notes.sort((a, b) => b.modified - a.modified || (a.path < b.path ? -1 : 1));
      return notes;
    };
    const listed = (paths: Iterable<string>) => [...paths].map((path) => this.#listed(path));

    if (selection.kind === 'all') {
      // Your order by default (backlog #12): new notes at the top until they're placed.
      const by = sort ?? 'order';
      const all = listed(this.#notes.keys());
      const notes = by === 'order' ? inYourOrder(all, this.#allOrder) : sorted(all, by);
      return {
        kind: 'all',
        heading: this.nameOf(selection),
        notes,
        total: notes.length,
        sort: by,
        sorts: ['order', 'title', 'modified'],
      };
    }
    if (selection.kind === 'pinned') {
      const by = sort ?? 'order';
      const notes = sorted(listed(this.pins), by);
      return {
        kind: 'pinned',
        heading: this.nameOf(selection),
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
      return {
        kind: 'tag',
        heading: this.nameOf(selection),
        notes,
        total: notes.length,
        sort: by,
        sorts: ['title', 'modified'],
      };
    }

    const folder = findFolder(this.#tree, selection.path) ?? this.#tree;
    const subfolders = subfoldersOf(folder);
    const groups = nested && subfolders.length > 0 ? subfolders : [];
    const settings = await Promise.all(
      [folder.path, ...groups.map((group) => group.path)].map((path) => this.folderSettings(path)),
    );
    const own = settings[0] ?? NO_FOLDER_SETTINGS;
    const book = own.book !== null;
    // A book, or a folder put in order by hand, opens in its own order.
    const by = sort ?? (book || own.order.length > 0 ? 'order' : 'modified');
    // Each folder's notes in its own order (a book's numbered), sorted within it: the groups stay in yours.
    const notes = [folder.path, ...groups.map((group) => group.path)].flatMap((path, at) => {
      const { order, book: isBook } = settings[at] ?? NO_FOLDER_SETTINGS;
      const names = orderNames((findFolder(folder, path)?.notes ?? []).map(baseName), order);
      return sorted(
        names.map((name, i) =>
          this.#listed(joinPath(path, name), isBook ? chapterNumber(i + 1, numerals) : undefined),
        ),
        by,
      );
    });
    return {
      kind: book ? 'book' : 'folder',
      heading: this.nameOf(selection),
      notes,
      total: notes.length,
      sort: by,
      sorts: ['order', 'title', 'modified'],
      folder: folder.path,
      ...(nested !== undefined && subfolders.length > 0 ? { nested } : {}),
      ...(groups.length > 0 ? { groups } : {}),
    };
  }

  /** A list's name: its heading, and what its search field says it searches. */
  nameOf(selection: Selection): string {
    if (selection.kind === 'all') return 'All Notes';
    if (selection.kind === 'pinned') return 'Pinned';
    if (selection.kind === 'tag') return `#${this.#tagNamed(selection.key)}`;
    return (findFolder(this.#tree, selection.path) ?? this.#tree).name;
  }

  /**
   * The notes holding every word of `query`, with the words around the
   * match: the whole vault's, or, `within` a list, only the notes it holds
   * (a folder's subfolders' too, `nested`, the hits in its groups).
   */
  async search(query: string, within: Selection | null = null, nested = false): Promise<NoteList> {
    // All Notes holds every note: the index needn't be told which.
    const list =
      within && within.kind !== 'all'
        ? await this.notesFor(within, undefined, undefined, undefined, nested)
        : null;
    const result = await this.#vault.search(query, list?.notes.map((note) => note.path) ?? null);
    const hits = result.hits.map((hit) => ({ ...this.#listed(hit.path), preview: hit.snippet }));
    const groups = list?.groups;
    return {
      kind: 'search',
      heading: `“${query.trim()}”`,
      notes: groups ? inGroups(hits, groups) : hits,
      total: result.total,
      sorts: [],
      ...(within ? { within: this.nameOf(within) } : {}),
      ...(groups ? { groups } : {}),
    };
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
