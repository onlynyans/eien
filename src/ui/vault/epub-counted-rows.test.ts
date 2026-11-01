// A book is counted a chapter at a time (#67, ../epub/book-count.ts), and a
// Marks or Found row names its place only once its chapter is: so each
// chapter counted draws the rows again, but only while the list shows that
// book's Marks or Found. Its Contents name no place, and another book's rows
// aren't this one's; drawing them then would be a task's work for nothing,
// as many times as the book has chapters.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { fixtureEpubs, SAMPLE_SOURCES } from '../../../tests/support/epub-fixtures';
import type { EpubSide } from '../epub/epub-side-types';
import type { BookLens } from '../list/book-lenses';
import { epubWiring } from './epub-wiring';
import { Navigation } from './navigation';
import type { Pages } from './pages';

const BOOK = fixtureEpubs(SAMPLE_SOURCES)['plain.epub'] as Uint8Array;
const PATH = 'Novels/Book.epub';

afterEach(() => {
  document.body.replaceChildren();
});

/** The book at PATH opened on a page the wiring made, the list showing `shown` in `lens`; once it's all counted, how often its rows were drawn. */
async function countedWith(shown: string | null, lens: BookLens) {
  const nav = new Navigation();
  nav.contents = shown;
  nav.bookLens = lens;
  const drawRows = vi.fn();
  const pages = { active: {}, sides: [] as unknown[] };
  const { kind } = epubWiring({
    vault: { readBytes: async () => BOOK.slice(), read: async () => null } as never,
    state: { sizeOf: () => 1024, has: () => false },
    nav,
    tell: () => {},
    redraw: () => {},
    drawRows,
    looks: () => {},
    marksAt: () => 'list',
    pages: () => pages as unknown as Pages,
    openChosen: async () => {},
    showPage: () => {},
    phone: () => false,
  });
  const side = kind.make({ close: () => {}, caret: () => {} }, null) as EpubSide;
  pages.sides.push(side);
  pages.active = side;
  document.body.append(side.page.element);
  await side.open(PATH);
  const last = (side.epub?.spine.length ?? 1) - 1;
  // The last item is counted last, the chapter drawn first: with no page-list, its place says a share once it is.
  await vi.waitFor(() => expect(side.labelAt(last, 0)).not.toBeNull(), { timeout: 5000 });
  return drawRows.mock.calls.length;
}

describe('a book counted, a chapter at a time', () => {
  it('draws the rows again as each is counted, while the list shows its Marks or its Found', async () => {
    expect(await countedWith(PATH, 'marks')).toBeGreaterThan(0);
    expect(await countedWith(PATH, 'found')).toBeGreaterThan(0);
  });

  it('draws nothing while the list shows its Contents, another book, or notes', async () => {
    expect(await countedWith(PATH, 'contents')).toBe(0);
    expect(await countedWith('Novels/Other.epub', 'marks')).toBe(0);
    expect(await countedWith(null, 'marks')).toBe(0);
  });
});
