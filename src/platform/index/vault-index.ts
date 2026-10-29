// What Eien knows of a vault without opening each note: its files and
// folders, and for every note a preview, its words and tags, and its text
// for search (spec §2, §4). Kept over any Storage, and refreshed by reading
// only what changed.

import { type IndexedNote, readNote } from '../../core/note';
import { baseName, titleOf } from '../../core/paths';
import { matchesAll, queryTerms, type SearchResult, searchText, snippet } from '../../core/search';
import { MAX_NOTE_BYTES, type VaultEntry } from '../../core/vault';
import type { Storage } from '../storage';

export { MAX_NOTE_BYTES } from '../../core/vault';

/** How many notes are read at once. */
const READS_AT_ONCE = 16;

/** The most hits a search returns; the total still counts them all. */
export const SEARCH_LIMIT = 200;

interface Known {
  readonly note: IndexedNote;
  /** It couldn't be read (locked, unreadable): try again on the next refresh. */
  readonly unreadable?: boolean;
  readonly size: number;
  /** The note's words, for snippets. */
  readonly plain: string;
  /** Title and words, folded, for matching. */
  readonly searchable: string;
}

export class VaultIndex {
  readonly #storage: Storage;
  #entries: VaultEntry[] = [];
  #notes = new Map<string, Known>();
  /** Paths the watcher named since the last refresh: read again even if they look the same. */
  readonly #dirty = new Set<string>();
  #running: Promise<void> | null = null;
  #queued: Promise<void> | null = null;

  constructor(storage: Storage) {
    this.#storage = storage;
  }

  /**
   * Bring the index up to date: list the vault again, and read the notes
   * that are new, changed (in time or size), or named in `changed`.
   * Refreshes run one at a time; a burst of them runs as one more.
   */
  refresh(changed: Iterable<string> = []): Promise<void> {
    for (const path of changed) this.#dirty.add(path);
    if (this.#queued) return this.#queued;
    if (!this.#running) {
      this.#running = this.#refresh();
      const done = () => {
        this.#running = null;
      };
      this.#running.then(done, done);
      return this.#running;
    }
    const next = () => {
      this.#queued = null;
      return this.refresh();
    };
    this.#queued = this.#running.then(next, next);
    return this.#queued;
  }

  /** Every folder and file, as last listed. */
  entries(): VaultEntry[] {
    return this.#entries;
  }

  /** Every note, with what the list shows of it. */
  notes(): IndexedNote[] {
    return [...this.#notes.values()].map((known) => known.note);
  }

  /**
   * The notes holding every word of `query`: those whose title holds them
   * first, then the most recently changed. Given `within`, only those notes
   * (a list's) are searched.
   */
  search(query: string, limit = SEARCH_LIMIT, within?: readonly string[] | null): SearchResult {
    const terms = queryTerms(query);
    if (terms.length === 0) return { total: 0, hits: [] };
    const among = within
      ? within.flatMap((path) => this.#notes.get(path) ?? [])
      : this.#notes.values();
    const found = [...new Set(among)].filter((known) => matchesAll(known.searchable, terms));
    const inTitle = new Set(
      found.filter((known) =>
        matchesAll(searchText(titleOf(baseName(known.note.path)), ''), terms),
      ),
    );
    found.sort(
      (a, b) =>
        Number(inTitle.has(b)) - Number(inTitle.has(a)) ||
        b.note.modified - a.note.modified ||
        (a.note.path < b.note.path ? -1 : 1),
    );
    return {
      total: found.length,
      hits: found
        .slice(0, limit)
        .map((known) => ({ path: known.note.path, snippet: snippet(known.plain, terms) })),
    };
  }

  async #refresh(): Promise<void> {
    const dirty = new Set(this.#dirty);
    this.#dirty.clear();
    try {
      const entries = await this.#storage.list();
      const next = new Map<string, Known>();
      const toRead: VaultEntry[] = [];
      for (const entry of entries) {
        if (entry.kind !== 'note') continue;
        const known = this.#notes.get(entry.path);
        const same = known && known.note.modified === entry.modified && known.size === entry.size;
        if (same && !known.unreadable && !dirty.has(entry.path)) next.set(entry.path, known);
        else toRead.push(entry);
      }
      const vanished = new Set<string>();
      await inBatches(toRead, READS_AT_ONCE, async (entry) => {
        const known = await this.#read(entry);
        if (known) next.set(entry.path, known);
        else vanished.add(entry.path);
      });
      this.#entries = entries.filter((entry) => !vanished.has(entry.path));
      this.#notes = next;
    } catch (error) {
      for (const path of dirty) this.#dirty.add(path); // still to read, next time
      throw error;
    }
  }

  /** Read one note; null when it vanished between the listing and the read. */
  async #read(entry: VaultEntry): Promise<Known | null> {
    const title = titleOf(baseName(entry.path));
    const listed = { path: entry.path, modified: entry.modified };
    if (entry.size > MAX_NOTE_BYTES) return unread(listed, entry.size, title);
    let text: string;
    try {
      const file = await this.#storage.read(entry.path);
      if (!file) return null;
      text = file.text;
    } catch {
      return { ...unread(listed, entry.size, title), unreadable: true }; // listed, and read again next time
    }
    const { plain, ...summary } = readNote(text, title);
    return {
      note: { ...listed, ...summary },
      size: entry.size,
      plain,
      searchable: searchText(title, plain),
    };
  }
}

/** A note listed by name only. */
const unread = (
  listed: { path: string; modified: number },
  size: number,
  title: string,
): Known => ({
  note: { ...listed, preview: '', words: 0, tags: [], id: null },
  size,
  plain: '',
  searchable: searchText(title, ''),
});

/** Run `task` over `items`, `width` at a time. */
async function inBatches<T>(
  items: readonly T[],
  width: number,
  task: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const item = items[next++] as T;
      await task(item);
    }
  };
  await Promise.all(Array.from({ length: Math.min(width, items.length) }, worker));
}
