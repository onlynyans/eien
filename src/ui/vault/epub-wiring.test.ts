// The EPUB's wiring (#40): a book moved or renamed by this window (or a folder
// above it) is followed by its pages, and by its contents in the list.

import { describe, expect, it, vi } from 'vitest';
import { epubWiring } from './epub-wiring';
import { Navigation } from './navigation';
import type { Pages } from './pages';

function wired(contents: string | null) {
  const nav = new Navigation();
  nav.contents = contents;
  const epubs = epubWiring({
    vault: { readBytes: vi.fn(async () => null) } as never,
    state: { sizeOf: () => null },
    nav,
    tell: () => {},
    redraw: () => {},
    pages: () => ({ active: {}, sides: [] }) as unknown as Pages,
    openHere: async () => {},
    showPage: () => {},
  });
  return { nav, kind: epubs.kind };
}

describe('a book moved', () => {
  it('takes its contents in the list with it, renamed, moved or a folder above it moved', () => {
    const { nav, kind } = wired('Novels/Dune.epub');
    kind.moved('Novels/Dune.epub', 'Novels/Arrakis.epub');
    expect(nav.contents).toBe('Novels/Arrakis.epub');
    kind.moved('Novels/Arrakis.epub', 'Arrakis.epub');
    expect(nav.contents).toBe('Arrakis.epub');
    kind.moved('Arrakis.epub', 'Shelf/Arrakis.epub');
    kind.moved('Shelf', 'Read/Shelf');
    expect(nav.contents).toBe('Read/Shelf/Arrakis.epub');
  });

  it('leaves another book’s contents, and a list of notes, as they are', () => {
    const { nav, kind } = wired('Novels/Dune.epub');
    kind.moved('Novels/Dune 2.epub', 'Novels/Arrakis.epub');
    kind.moved('Nov', 'Old');
    expect(nav.contents).toBe('Novels/Dune.epub');
    const none = wired(null);
    none.kind.moved('Novels/Dune.epub', 'Arrakis.epub');
    expect(none.nav.contents).toBeNull();
  });
});
