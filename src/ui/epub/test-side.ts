// A book's page over a vault the test holds (#40): the vault's books as
// bytes, their reading states kept in memory, and what the page told. For
// the DOM tests of ui/epub, which run in happy-dom.

import { type Mock, vi } from 'vitest';
import type { Reading } from '../../core/epub';
import { MemoryStorage } from '../../platform/memory/memory-storage';
import { BookCounts } from './book-count';
import { BookTexts } from './book-search';
import { makeEpubSide } from './epub-side';
import type { EpubSide, EpubSideOf } from './epub-side-types';
import { readingStore } from './reading-store';

/** A vault of `files` (bytes), its reading states kept in memory, and what the page told. */
export function sideWith(
  files: Record<string, Uint8Array>,
  listed: string[] = Object.keys(files),
): {
  side: EpubSide;
  kept: Map<string, Reading>;
  reads: Mock;
  changed: Mock;
  close: Mock;
  of: EpubSideOf;
  writes: Mock;
  /** The vault in memory the reading state's files are kept in. */
  disk: MemoryStorage;
  files: Record<string, Uint8Array>;
  listed: string[];
} {
  const kept = new Map<string, Reading>();
  const reads = vi.fn(async (path: string) => files[path]?.slice() ?? null);
  const changed = vi.fn();
  const writes = vi.fn();
  const disk = new MemoryStorage();
  const store = readingStore(disk, () => {});
  const of: EpubSideOf = {
    vault: { readBytes: reads },
    // The store over a vault in memory, its places also kept where the test reads and sets them.
    reading: {
      ...store,
      read: async (key) => {
        const read = await store.read(key);
        return { ...read, reading: kept.get(key) ?? read.reading };
      },
      write: async (key, reading) => {
        writes(key, reading);
        kept.set(key, reading);
        await store.write(key, reading);
      },
    },
    counts: new BookCounts(),
    texts: new BookTexts(),
    still: (then) => then(),
    looks: vi.fn(),
    sizeOf: (path: string) =>
      listed.includes(path) ? (files[path]?.length ?? 64 * 1024 * 1024) : null,
    changed,
    quote: async () => ({ not: 'Open a note beside the book to quote into it.' }),
  };
  const close = vi.fn();
  const side = makeEpubSide(of, { close, caret: () => {} }, null);
  document.body.append(side.page.element);
  return { side, kept, reads, changed, close, of, writes, disk, files, listed };
}
