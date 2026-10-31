// The EPUB's wiring (#40): a book moved or renamed by this window (or a folder
// above it) is followed by its pages, and by its contents in the list; and a
// quote goes into the note beside, or on a phone's one page, the note the
// book was opened from (Phase 2c).

import { afterEach, describe, expect, it, vi } from 'vitest';
import { fixtureEpubs, SAMPLE_SOURCES } from '../../../tests/support/epub-fixtures';
import { readingPath } from '../../core/epub';
import type { EpubSide } from '../epub/epub-side-types';
import { sideWith } from '../epub/test-side';
import { epubWiring } from './epub-wiring';
import { Navigation } from './navigation';
import type { Pages } from './pages';

function wired(
  contents: string | null,
  pages: unknown = { active: {}, sides: [] },
  phone = false,
  bytes: Uint8Array | null = null,
  marksAt: 'list' | 'edge' = 'list',
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
    looks: () => {},
    marksAt: () => marksAt,
    pages: () => pages as Pages,
    openChosen: async () => {},
    showPage: () => {},
    phone: () => phone,
  });
  return { nav, kind: epubs.kind, epubs };
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

describe('a book’s Marks in the list (Phase 4c)', () => {
  it('are its bookmarks in its order, each with its page and its chapter', async () => {
    const { side, disk } = sideWith({ 'a.epub': BOOK });
    await side.open('a.epub');
    const key = side.epub?.key ?? '';
    await disk.write(
      readingPath(key),
      JSON.stringify({
        bookmarks: [
          { chapter: 'OEBPS/chapter-3.xhtml', offset: 10, words: 'later' },
          { chapter: 'OEBPS/chapter-1.xhtml', offset: 0, words: 'first' },
          { chapter: 'OEBPS/gone.xhtml', offset: 0, words: 'not in the book' },
        ],
      }),
      null,
    );
    await side.reload();
    const { epubs } = wired('a.epub', { active: side, sides: [side] });
    const contents = epubs.contents();
    expect(contents?.marks?.map((row) => [row.mark.words, row.spine, row.chapter])).toEqual([
      ['first', 1, 'Chapter I'],
      ['later', 3, 'Chapter III'],
    ]);
    expect(contents?.lens).toBe('contents');
    // Marks on the edge (Phase 4d): the list is the contents alone.
    expect(
      wired('a.epub', { active: side, sides: [side] }, false, null, 'edge').epubs.contents()?.marks,
    ).toBeNull();
  });

  it('go to a bookmark on the book’s own page, made the active one, a note beside it staying', () => {
    const goTo = vi.fn(async () => {});
    const book = { kind: 'epub', go: () => {}, path: 'a.epub', goTo };
    const note = { kind: 'note', path: 'Note.md' };
    const activate = vi.fn();
    const { epubs } = wired('a.epub', { active: note, sides: [note, book], activate });
    const mark = { chapter: 'OEBPS/chapter-3.xhtml', offset: 40, words: 'later' };
    epubs.actions.goMark('a.epub', { mark, spine: 3, page: '2', chapter: 'Chapter III' });
    expect(activate).toHaveBeenCalledWith(book);
    expect(goTo).toHaveBeenCalledWith(3, 40);
  });

  it('begin at Contents for another book, and keep their lens as the book moves', () => {
    const { nav, kind, epubs } = wired('Novels/Dune.epub');
    epubs.actions.lens('Novels/Dune.epub', 'marks');
    expect(nav.bookLens).toBe('marks');
    kind.moved('Novels/Dune.epub', 'Novels/Arrakis.epub');
    expect(nav.bookLens).toBe('marks');
    epubs.actions.openEpub('Novels/Arrakis.epub');
    expect(nav.bookLens).toBe('marks');
    epubs.actions.openEpub('Novels/Emma.epub');
    expect(nav.bookLens).toBe('contents');
  });
});

describe('a book’s Marks, as QA tried them (Phase 4c)', () => {
  /** The wiring over `pages`, its redraws and pages shown counted. */
  function watched(contents: string | null, pages: unknown) {
    const nav = new Navigation();
    nav.contents = contents;
    const redraw = vi.fn();
    const showPage = vi.fn();
    const epubs = epubWiring({
      vault: { readBytes: vi.fn(async () => null), read: async () => null } as never,
      state: { sizeOf: () => 1024, has: () => false },
      nav,
      tell: () => {},
      redraw,
      looks: () => {},
      marksAt: () => 'list',
      pages: () => pages as Pages,
      openChosen: async () => {},
      showPage,
      phone: () => false,
    });
    return { nav, epubs, redraw, showPage };
  }
  const ROW = {
    mark: { chapter: 'OEBPS/chapter-3.xhtml', offset: 40, words: 'later' },
    spine: 3,
    page: '2',
    chapter: 'Chapter III',
  };
  const bookSide = (path: string) => ({
    kind: 'epub',
    path,
    go: () => {},
    goTo: vi.fn(async () => {}),
    unmark: vi.fn(async () => {}),
  });

  it('take a bookmark off on the book’s own page, the note beside it staying the active one', () => {
    const book = bookSide('a.epub');
    const note = { kind: 'note', path: 'Note.md', unmark: vi.fn() };
    const activate = vi.fn();
    const { epubs, showPage } = watched('a.epub', { active: note, sides: [note, book], activate });
    epubs.actions.unmark('a.epub', ROW);
    expect(book.unmark).toHaveBeenCalledExactlyOnceWith(ROW.mark);
    expect(note.unmark).not.toHaveBeenCalled();
    // Taken off from the list: the keyboard and the page stay where they are.
    expect(activate).not.toHaveBeenCalled();
    expect(showPage).not.toHaveBeenCalled();
  });

  it('go to a bookmark on the active page when two pages hold the book', () => {
    const left = bookSide('a.epub');
    const right = bookSide('a.epub');
    const activate = vi.fn();
    const { epubs } = watched('a.epub', { active: right, sides: [left, right], activate });
    epubs.actions.goMark('a.epub', ROW);
    expect(right.goTo).toHaveBeenCalledWith(3, 40);
    expect(left.goTo).not.toHaveBeenCalled();
    expect(activate).toHaveBeenCalledWith(right);
  });

  it('do nothing for a book on no page: no page shown, nothing taken off', () => {
    const note = { kind: 'note', path: 'Note.md' };
    const activate = vi.fn();
    const { epubs, showPage } = watched('a.epub', { active: note, sides: [note], activate });
    expect(() => epubs.actions.goMark('a.epub', ROW)).not.toThrow();
    expect(() => epubs.actions.unmark('a.epub', ROW)).not.toThrow();
    expect(activate).not.toHaveBeenCalled();
    expect(showPage).not.toHaveBeenCalled();
  });

  it('draw the panes again when a lens is chosen', () => {
    const { nav, epubs, redraw } = watched('a.epub', { active: {}, sides: [] });
    epubs.actions.lens('a.epub', 'marks');
    expect(nav.bookLens).toBe('marks');
    expect(redraw).toHaveBeenCalledOnce();
  });

  it('begin at Contents for another book even from Marks, and stay on Marks for the same one opened again', () => {
    const { nav, epubs } = watched('Novels/Dune.epub', { active: {}, sides: [] });
    nav.bookLens = 'marks';
    epubs.actions.openEpub('Novels/Dune.epub');
    expect(nav.bookLens).toBe('marks');
    // No book shown before (the list of notes): the first one starts at Contents.
    nav.contents = null;
    epubs.actions.openEpub('Novels/Dune.epub');
    expect(nav.bookLens).toBe('contents');
  });

  it('are under the book’s SHELF row with two panes, the lens with them; and with one pane, not there', async () => {
    const { side, disk } = sideWith({ 'a.epub': BOOK });
    await side.open('a.epub');
    await disk.write(
      readingPath(side.epub?.key ?? ''),
      JSON.stringify({
        bookmarks: [{ chapter: 'OEBPS/chapter-1.xhtml', offset: 0, words: 'first' }],
      }),
      null,
    );
    await side.reload();
    const { epubs, nav } = watched('a.epub', { active: side, sides: [side] });
    nav.bookLens = 'marks';
    const shelf = epubs.shelf(true);
    expect(shelf.contents?.lens).toBe('marks');
    expect(shelf.contents?.marks?.map((row) => row.mark.words)).toEqual(['first']);
    expect(epubs.shelf(false).contents).toBeNull();
  });

  it('call a bookmark in a spine item no contents row names by the book’s name', async () => {
    const { side, disk } = sideWith({ 'a.epub': BOOK });
    await side.open('a.epub');
    const first = side.epub?.spine[0]?.path ?? '';
    expect(side.epub?.contents.some((entry) => entry.spine === 0)).toBe(false);
    await disk.write(
      readingPath(side.epub?.key ?? ''),
      JSON.stringify({ bookmarks: [{ chapter: first, offset: 0, words: '' }] }),
      null,
    );
    await side.reload();
    const { epubs } = watched('a.epub', { active: side, sides: [side] });
    const [row] = epubs.contents()?.marks ?? [];
    expect(row?.spine).toBe(0);
    expect(row?.chapter).toBe(side.page.name);
    expect(row?.chapter).not.toBe('');
  });

  // None until then is ../epub/book-place.test.ts's: here the count runs on its own time.
  it('have their steady pages once a book with no page-list is counted, rising through the book', async () => {
    // The sample's chapters thirty times over: a book of several steady pages, not one.
    const long = fixtureEpubs({
      ...SAMPLE_SOURCES,
      chapters: SAMPLE_SOURCES.chapters.map((paras) =>
        Array.from({ length: 30 }, () => paras).flat(),
      ),
    })['plain.epub'] as Uint8Array;
    const { side, disk } = sideWith({ 'a.epub': long });
    await side.open('a.epub');
    await disk.write(
      readingPath(side.epub?.key ?? ''),
      JSON.stringify({
        bookmarks: [
          { chapter: 'OEBPS/chapter-1.xhtml', offset: 0, words: 'first' },
          { chapter: 'OEBPS/chapter-3.xhtml', offset: 100_000, words: 'past its end' },
        ],
      }),
      null,
    );
    await side.reload();
    const { epubs } = watched('a.epub', { active: side, sides: [side] });
    const pages = () => (epubs.contents()?.marks ?? []).map((row) => row.page);
    expect(pages()).toHaveLength(2);
    // A task an item: given time, as the whole suite running beside it slows each one.
    await vi.waitFor(() => expect(pages().every((page) => page !== null)).toBe(true), {
      timeout: 5000,
    });
    const [first, last] = pages().map(Number);
    expect(first).toBe(1);
    expect(last).toBeGreaterThan(first as number);
  });
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
