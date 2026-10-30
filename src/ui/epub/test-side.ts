// A book's page over a vault the test holds (#40): the vault's books as
// bytes, their reading states kept in memory, and what the page told. For
// the DOM tests of ui/epub, which run in happy-dom.

import { type Mock, vi } from 'vitest';
import type { Reading } from '../../core/epub';
import { BookCounts } from './book-count';
import { makeEpubSide } from './epub-side';
import type { EpubSide, EpubSideOf } from './epub-side-types';

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
  files: Record<string, Uint8Array>;
  listed: string[];
} {
  const kept = new Map<string, Reading>();
  const reads = vi.fn(async (path: string) => files[path]?.slice() ?? null);
  const changed = vi.fn();
  const writes = vi.fn();
  const of: EpubSideOf = {
    vault: { readBytes: reads },
    reading: {
      read: async (key) => kept.get(key) ?? { chapter: null, offset: 0 },
      write: async (key, reading) => {
        writes(key, reading);
        kept.set(key, reading);
      },
      idle: async () => {},
    },
    counts: new BookCounts(),
    sizeOf: (path: string) =>
      listed.includes(path) ? (files[path]?.length ?? 64 * 1024 * 1024) : null,
    changed,
    quote: async () => ({ not: 'Open a note beside the book to quote into it.' }),
  };
  const close = vi.fn();
  const side = makeEpubSide(of, { close, caret: () => {} }, null);
  document.body.append(side.page.element);
  return { side, kept, reads, changed, close, of, writes, files, listed };
}
