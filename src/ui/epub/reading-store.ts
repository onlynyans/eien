// The reading state's file (#40, core/epub/reading.ts) read and written
// through the vault, at the version read, as the vault's other small files
// are (../vault/small-files.ts). Written when the chapter changes, or the
// page comes to rest somewhere new (./place-keeper.ts): each write reads the
// vault again, so never as a page scrolls. The writes are the store's, one
// after another, so a page closed just after a chapter changed is still
// waited for by a quit (the kind's flush). A book's marks (its bookmarks,
// Phase 4b) change in the same file, one change a write, each decided
// against the file as it is then (another device's change synced meanwhile
// included); every page of that book in the window is told, so two pages on
// one book, the list and the tools agree. One store for the window.

import {
  type Bookmark,
  bookmarksOf,
  parseReading,
  type Reading,
  type ReadingKept,
  readingKept,
  readingPath,
  withReading,
} from '../../core/epub';
import type { VaultBridge } from '../../platform/bridge';
import { SmallFiles } from '../vault/small-files';

/** A book's marks, as its file holds them. */
export interface ReadingMarks {
  readonly bookmarks: readonly Bookmark[];
}

/** The marks the file's text holds, every kind. */
const marksOf = (text: string | null): ReadingMarks => ({ bookmarks: bookmarksOf(text) });

/** What the file holds of a book: the place, its marks, and how the file stands. */
export interface ReadingRead {
  readonly reading: Reading;
  readonly marks: ReadingMarks;
  readonly kept: ReadingKept;
}

/** A change to a book's marks: the file's text as it is now, made new; null where it mustn't be written. */
export type MarksEdit = (text: string | null) => string | null;

export interface ReadingStore {
  read(key: string): Promise<ReadingRead>;
  /** Keep `reading` for the book `key` names, after any write under way. */
  write(key: string, reading: Reading): Promise<void>;
  /**
   * Change the book's marks by `edit`, run on the file as it is then, after
   * any write under way: the marks as the file then holds them, or null when
   * they couldn't be kept (a newer Eien's file, or one that can't be read).
   */
  change(key: string, edit: MarksEdit): Promise<ReadingMarks | null>;
  /** `told` whenever the book `key` names has its marks changed here; undone by what it returns. */
  listen(key: string, told: (marks: ReadingMarks) => void): () => void;
  /** Every write asked for, done. */
  idle(): Promise<void>;
}

export function readingStore(
  vault: Pick<VaultBridge, 'read' | 'write'>,
  tell: (message: string) => void,
): ReadingStore {
  const files = new SmallFiles({ vault, tell });
  const listeners = new Map<string, Set<(marks: ReadingMarks) => void>>();
  let writing: Promise<void> = Promise.resolve();
  /** `work` after every write asked for before it; never rejecting. */
  const queued = <T>(work: () => Promise<T>, failed: T): Promise<T> => {
    const done = writing.then(work).catch(() => failed);
    writing = done.then(() => {});
    return done;
  };
  return {
    // After any write asked for, so a page opening as a bookmark is kept reads it.
    read: (key) =>
      queued<ReadingRead>(
        async () => {
          const text = (await vault.read(readingPath(key)).catch(() => null))?.text ?? null;
          return {
            reading: parseReading(text),
            marks: marksOf(text),
            kept: readingKept(text),
          };
        },
        { reading: parseReading(null), marks: marksOf(null), kept: 'none' },
      ),
    // A file that mustn't be written (a newer Eien's, or one that can't be read): nothing to write.
    write: (key, reading) =>
      queued(
        () =>
          files
            .update(readingPath(key), (text) => withReading(text, reading) ?? undefined, 'reading')
            .then(() => {}),
        undefined,
      ),
    change: (key, edit) =>
      queued(async () => {
        let after: ReadingMarks | null = null;
        const written = await files.update(
          readingPath(key),
          (text) => {
            const next = edit(text);
            after = next === null ? null : marksOf(next);
            return next ?? undefined;
          },
          'reading',
        );
        return written ? (after as ReadingMarks | null) : null;
      }, null).then((marks) => {
        // Told once kept, outside the write: a page that fails to show it never unkeeps it.
        if (marks) {
          for (const told of listeners.get(key) ?? []) {
            try {
              told(marks);
            } catch (error) {
              console.error(error);
            }
          }
        }
        return marks;
      }),
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
