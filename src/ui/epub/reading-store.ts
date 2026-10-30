// The reading state's file (#40, core/epub/reading.ts) read and written
// through the vault, at the version read, as the vault's other small files
// are (../vault/small-files.ts). Written when the chapter changes, or the
// page comes to rest somewhere new (./place-keeper.ts): each write reads the
// vault again, so never as a page scrolls. The writes are the store's, one
// after another, so a page closed just after a chapter changed is still
// waited for by a quit (the kind's flush). A book's bookmarks (Phase 4b)
// change in the same file, one change a write, and every page of that book
// in the window is told, so two pages on one book, the list and the tool
// agree. One store for the window.

import {
  type Bookmark,
  bookmarksOf,
  parseReading,
  type Reading,
  type ReadingKept,
  readingKept,
  readingPath,
  withBookmarks,
  withReading,
} from '../../core/epub';
import type { VaultBridge } from '../../platform/bridge';
import { SmallFiles } from '../vault/small-files';

/** What the file holds of a book: the place, its bookmarks, and how the file stands. */
export interface ReadingRead {
  readonly reading: Reading;
  readonly bookmarks: readonly Bookmark[];
  readonly kept: ReadingKept;
}

/** A change to a book's bookmarks: one added, some taken off. */
export interface MarkChange {
  readonly add?: Bookmark;
  readonly remove?: readonly Bookmark[];
}

export interface ReadingStore {
  read(key: string): Promise<ReadingRead>;
  /** Keep `reading` for the book `key` names, after any write under way. */
  write(key: string, reading: Reading): Promise<void>;
  /**
   * Change the book's bookmarks, after any write under way: the bookmarks as
   * the file then holds them, or null when they couldn't be kept (a newer
   * Eien's file, or one that can't be read).
   */
  mark(key: string, change: MarkChange): Promise<readonly Bookmark[] | null>;
  /** `told` whenever the book `key` names has its bookmarks changed here; undone by what it returns. */
  listen(key: string, told: (bookmarks: readonly Bookmark[]) => void): () => void;
  /** Every write asked for, done. */
  idle(): Promise<void>;
}

export function readingStore(
  vault: Pick<VaultBridge, 'read' | 'write'>,
  tell: (message: string) => void,
): ReadingStore {
  const files = new SmallFiles({ vault, tell });
  const listeners = new Map<string, Set<(bookmarks: readonly Bookmark[]) => void>>();
  let writing: Promise<void> = Promise.resolve();
  /** `work` after every write asked for before it; never rejecting. */
  const queued = <T>(work: () => Promise<T>, failed: T): Promise<T> => {
    const done = writing.then(work).catch(() => failed);
    writing = done.then(() => {});
    return done;
  };
  return {
    read: async (key) => {
      const text = (await vault.read(readingPath(key)).catch(() => null))?.text ?? null;
      return { reading: parseReading(text), bookmarks: bookmarksOf(text), kept: readingKept(text) };
    },
    // A file that mustn't be written (a newer Eien's, or one that can't be read): nothing to write.
    write: (key, reading) =>
      queued(
        () =>
          files
            .update(readingPath(key), (text) => withReading(text, reading) ?? undefined, 'reading')
            .then(() => {}),
        undefined,
      ),
    mark: (key, change) =>
      queued(async () => {
        let after: readonly Bookmark[] | null = null;
        const written = await files.update(
          readingPath(key),
          (text) => {
            const next = withBookmarks(text, change);
            after = next === null ? null : bookmarksOf(next);
            return next ?? undefined;
          },
          'reading',
        );
        const marks = written ? (after as readonly Bookmark[] | null) : null;
        if (marks) for (const told of listeners.get(key) ?? []) told(marks);
        return marks;
      }, null),
    listen: (key, told) => {
      const set = listeners.get(key) ?? new Set();
      set.add(told);
      listeners.set(key, set);
      return () => {
        set.delete(told);
        if (set.size === 0) listeners.delete(key);
      };
    },
    idle: () => writing,
  };
}
