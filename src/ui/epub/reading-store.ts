// The reading state's file (#40, core/epub/reading.ts) read and written
// through the vault, at the version read, as the vault's other small files
// are (../vault/small-files.ts). Written only when the chapter changes: each
// write reads the vault again, so never as a page scrolls. The writes are
// the store's, one after another, so a page closed just after a chapter
// changed is still waited for by a quit (the kind's flush).

import { parseReading, type Reading, readingPath, withReading } from '../../core/epub';
import type { VaultBridge } from '../../platform/bridge';
import { SmallFiles } from '../vault/small-files';

export interface ReadingStore {
  read(key: string): Promise<Reading>;
  /** Keep `reading` for the book `key` names, after any write under way. */
  write(key: string, reading: Reading): Promise<void>;
  /** Every write asked for, done. */
  idle(): Promise<void>;
}

export function readingStore(
  vault: Pick<VaultBridge, 'read' | 'write'>,
  tell: (message: string) => void,
): ReadingStore {
  const files = new SmallFiles({ vault, tell });
  let writing: Promise<void> = Promise.resolve();
  return {
    read: async (key) =>
      parseReading((await vault.read(readingPath(key)).catch(() => null))?.text ?? null),
    write: (key, reading) => {
      // A file a newer Eien wrote is left as it is: nothing to write.
      writing = writing
        .then(() =>
          files.update(
            readingPath(key),
            (text) => withReading(text, reading) ?? undefined,
            'reading',
          ),
        )
        .then(
          () => {},
          () => {},
        );
      return writing;
    },
    idle: () => writing,
  };
}
