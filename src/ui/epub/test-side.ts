// A book's page over a vault the test holds (#40): the vault's books as
// bytes, their reading states kept in memory, and what the page told. For
// the DOM tests of ui/epub, which run in happy-dom.

import { afterEach, type Mock, vi } from 'vitest';
import type { Reading } from '../../core/epub';
import { MemoryStorage } from '../../platform/memory/memory-storage';
import { BookCounts } from './book-count';
import { BookTexts } from './book-search';
import { boundsOf, rangeOver, walked } from './chapter-range';
import { makeEpubSide } from './epub-side';
import type { EpubSide, EpubSideOf } from './epub-side-types';
import { readingStore } from './reading-store';

/**
 * Every page made here, let go after each test: a book's count goes on in the background, and a
 * page left open would draw its edge strip into a document already gone (an unhandled error that
 * fails the run, though every test passed). A test that lets its page go itself is let be.
 */
const made = new Set<EpubSide>();
afterEach(() => {
  for (const side of made) side.dispose();
  made.clear();
});

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
    counted: vi.fn(),
    quote: async () => ({ not: 'Open a note beside the book to quote into it.' }),
    copy: vi.fn(async () => {}),
  };
  const close = vi.fn();
  const side = makeEpubSide(of, { close, caret: () => {} }, null);
  // Let go once, whether the test or the hook above does it.
  const letGo = side.dispose.bind(side);
  side.dispose = () => {
    if (made.delete(side)) letGo();
  };
  made.add(side);
  document.body.append(side.page.element);
  return { side, kept, reads, changed, close, of, writes, disk, files, listed };
}

/** `words` chosen in the chapter on `side`'s page, as a hand leaves them. */
export function choose(side: EpubSide, words: string): void {
  // The chapter's text as a place counts it is its pieces': the fixture's first chapter has no blank ones but between blocks.
  const walk = walked(side.page.chapter);
  const offset = walk.pieces
    .map((piece) => piece.data)
    .join('')
    .indexOf(words);
  const bounds = offset < 0 ? null : boundsOf(walk, { from: offset, to: offset + words.length });
  if (!bounds) throw new Error(`no “${words}” on the page`);
  const selection = document.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(rangeOver(bounds));
}
