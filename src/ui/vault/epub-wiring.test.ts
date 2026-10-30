// The EPUB's wiring (#40): a book moved or renamed by this window (or a folder
// above it) is followed by its pages, and by its contents in the list; and a
// quote goes into the note beside, or on a phone's one page, the note the
// book was opened from (Phase 2c).

import { afterEach, describe, expect, it, vi } from 'vitest';
import { fixtureEpubs, SAMPLE_SOURCES } from '../../../tests/support/epub-fixtures';
import type { EpubSide } from '../epub/epub-side';
import { epubWiring } from './epub-wiring';
import { Navigation } from './navigation';
import type { Pages } from './pages';

function wired(
  contents: string | null,
  pages: unknown = { active: {}, sides: [] },
  phone = false,
  bytes: Uint8Array | null = null,
) {
  const nav = new Navigation();
  nav.contents = contents;
  const epubs = epubWiring({
    vault: {
      readBytes: vi.fn(async () => bytes?.slice() ?? null),
      read: async () => null,
    } as never,
    state: { sizeOf: () => 1024, has: (path) => path === 'Assembly.md' },
    nav,
    tell: () => {},
    redraw: () => {},
    pages: () => pages as Pages,
    openChosen: async () => {},
    showPage: () => {},
    phone: () => phone,
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

const BOOK = fixtureEpubs(SAMPLE_SOURCES)['plain.epub'] as Uint8Array;

/** A note's page, as the pages hold one: its editor takes the quote. */
function notePage(path: string) {
  const added: string[] = [];
  const told: string[] = [];
  return {
    added,
    told,
    side: {
      kind: 'note',
      path,
      page: {
        name: 'At the Assembly',
        foot: { tell: (words: string) => told.push(words) },
        editor: {
          addAtEnd: (add: (text: string) => string) => {
            added.push(add('She hears it.\n'));
            return true;
          },
        },
      },
    },
  };
}

/** A book's page made by the wiring's kind, open, a paragraph of it chosen; `left` the place it came from. */
async function bookPage(kind: ReturnType<typeof wired>['kind'], left: unknown = null) {
  const side = kind.make({ close: () => {}, caret: () => {} }, left as never) as EpubSide;
  document.body.append(side.page.element);
  await side.open('Novels/Book.epub');
  const range = document.createRange();
  range.selectNodeContents(side.page.chapter.querySelector('p:nth-of-type(2)') as Node);
  document.getSelection()?.removeAllRanges();
  document.getSelection()?.addRange(range);
  return side;
}

afterEach(() => {
  document.getSelection()?.removeAllRanges();
  document.body.replaceChildren();
});

describe('a quote', () => {
  it('goes into the note on the page beside the book', async () => {
    const note = notePage('Assembly.md');
    const pages = { active: {}, sides: [] as unknown[] };
    const { kind } = wired(null, pages, false, BOOK);
    const book = await bookPage(kind);
    pages.sides.push(book, note.side);
    pages.active = book;
    await book.quote();
    expect(note.added).toHaveLength(1);
    expect(note.added[0]).toMatch(
      /^She hears it\.\n\n> .+\n>\n> — Pride and Prejudice, Chapter I\n$/su,
    );
    expect(book.page.foot.said.textContent).toBe('Quoted in At the Assembly.');
  });

  it('with one page on the desktop, goes nowhere, and says where to open a note', async () => {
    const pages = { active: {}, sides: [] as unknown[] };
    const { kind } = wired(null, pages, false, BOOK);
    const book = await bookPage(kind, { path: 'Assembly.md', name: 'Assembly' });
    pages.sides.push(book);
    await book.quote();
    expect(book.page.foot.said.textContent).toBe('Open a note beside the book to quote into it.');
  });

  it('on a phone’s one page, opens the note the book came from where it was, and goes into it', async () => {
    const note = notePage('Assembly.md');
    const left = { path: 'Assembly.md', name: 'Assembly' };
    const pages = {
      active: {} as unknown,
      sides: [] as unknown[],
      // As the pages do: the note takes the book's place in its slot, and the book's page goes.
      open: vi.fn(async () => {
        (pages.active as EpubSide).dispose();
        pages.sides.splice(0, 1, note.side);
        pages.active = note.side;
      }),
    };
    const { kind } = wired(null, pages, true, BOOK);
    const book = await bookPage(kind, left);
    pages.sides.push(book);
    pages.active = book;
    await book.quote();
    expect(pages.open).toHaveBeenCalledWith('Assembly.md', false, left);
    expect(note.added).toHaveLength(1);
    // Said where the writer is now, on the note's colophon: the book's page is gone.
    expect(note.told).toEqual(['Quoted in At the Assembly.']);
    expect(book.page.foot.said.textContent).toBe('');
    // A place it came from that isn't a note there now: nowhere to go.
    const elsewhere = await bookPage(kind, { path: 'Gone.md', name: 'Gone' });
    pages.active = elsewhere;
    pages.sides.splice(0, 1, elsewhere);
    await elsewhere.quote();
    expect(note.added).toHaveLength(1);
  });
});
