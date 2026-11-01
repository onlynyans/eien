// A book's bookmarks and its page numbers on a spread (#40, Phase 3d): the
// mark sits on the page it marks, B marks the spread's first word and takes
// off every bookmark on its two pages, the colophon says both pages, and
// Eien's front matter has nothing to mark or number.

import { describe, expect, it, vi } from 'vitest';
import { type Bookmark, bookmarksOf, type Epub } from '../../core/epub';
import type { BookCount } from './book-count';
import { BookFoot } from './book-foot';
import { bookPlace } from './book-place';
import type { EpubPage } from './epub-page';
import { frontMatter } from './front-matter';
import { PageBookmarks } from './page-bookmarks';
import type { MarksEdit } from './reading-store';
import { RunningHeads } from './running-heads';
import type { PageShown } from './sight';

const CHAPTER = 'OEBPS/chapter-1.xhtml';
const SPREAD: readonly PageShown[] = [
  { role: 'text', from: 1000 },
  { role: 'text', from: 1600 },
];
const FRONT: readonly PageShown[] = [
  { role: 'front', from: 0 },
  { role: 'front', from: 0 },
];

/** A book's bookmarks over a page whose sight is `sight`, the file holding `kept`. */
function marked(sight: readonly PageShown[], kept: readonly Bookmark[]) {
  const chapter = document.createElement('div');
  chapter.innerHTML = `<p>${'word '.repeat(600)}</p>`;
  const page = {
    bookmarked: vi.fn(),
    foot: { say: vi.fn() },
    chapter,
    sheet: { keep: vi.fn(), sight },
  };
  // The book's reading file, as the store would change it.
  let file: string | null = JSON.stringify({ version: 1, bookmarks: kept });
  const change = vi.fn(async (edit: MarksEdit) => {
    const next = edit(file);
    if (next === null) return null;
    file = next;
    return { bookmarks: bookmarksOf(file), highlights: [] };
  });
  const marks = new PageBookmarks({
    page: page as never,
    change,
    chapter: () => CHAPTER,
    still: (then) => then(),
    land: () => {},
    changed: () => {},
  });
  marks.set(kept);
  return { marks, page, change, kept: () => bookmarksOf(file) };
}

const at = (offset: number): Bookmark => ({ chapter: CHAPTER, offset, words: '' });

describe('a bookmark on a spread', () => {
  it('sits on the page it marks: the verso’s at its left, the recto’s at its right', () => {
    const verso = marked(SPREAD, [at(1200)]);
    verso.marks.inSight(1000, 2200);
    expect(verso.page.bookmarked).toHaveBeenLastCalledWith(true, false);
    const recto = marked(SPREAD, [at(1600)]);
    recto.marks.inSight(1000, 2200);
    expect(recto.page.bookmarked).toHaveBeenLastCalledWith(false, true);
    const both = marked(SPREAD, [at(1000), at(2100)]);
    both.marks.inSight(1000, 2200);
    expect(both.page.bookmarked).toHaveBeenLastCalledWith(true, true);
    expect(both.marks.on).toBe(true);
    // The next spread's first word is none of this one's.
    const next = marked(SPREAD, [at(2200)]);
    next.marks.inSight(1000, 2200);
    expect(next.page.bookmarked).toHaveBeenLastCalledWith(false, false);
  });

  it('is made at the spread’s first word, and B takes off every one on its two pages', async () => {
    const none = marked(SPREAD, []);
    none.marks.inSight(1000, 2200);
    await none.marks.toggle();
    expect(none.kept()).toEqual([expect.objectContaining({ chapter: CHAPTER, offset: 1000 })]);
    const two = [at(1100), at(1900)];
    // One beyond the spread, kept: B takes off its two pages' alone.
    const beyond = at(2500);
    const some = marked(SPREAD, [...two, beyond]);
    some.marks.inSight(1000, 2200);
    await some.marks.toggle();
    expect(some.kept()).toEqual([beyond]);
  });

  it('is never made on the front matter, which holds none of the book’s words', async () => {
    const front = marked(FRONT, [at(0)]);
    front.marks.inSight(0, 0);
    expect(front.page.bookmarked).toHaveBeenLastCalledWith(false, false);
    await front.marks.toggle();
    expect(front.change).not.toHaveBeenCalled();
  });
});

describe('a spread’s pages in the colophon', () => {
  /**
   * A book's place over a page in pages whose sight is `sight`, `at` the
   * chapter's own page first in it, of four; its count `print`'s pages where given.
   */
  function placed(sight: readonly PageShown[], at = 0, print: readonly unknown[] = []) {
    const foot = new BookFoot(
      () => {},
      () => {},
    );
    const heads = new RunningHeads();
    const place = bookPlace({
      page: {
        foot,
        heads,
        element: document.createElement('div'),
        chapter: document.createElement('div'),
        sheet: { sight, paged: true, page: { at, of: 4, per: 2 } },
      } as unknown as EpubPage,
      epub: () => ({ title: 'Book', spine: [{ path: CHAPTER }], contents: [] }) as unknown as Epub,
      spine: () => 0,
      count: () => ({ lengths: [6000], print }) as unknown as BookCount,
      marks: () => [],
      goTo: () => {},
    });
    const said = () => foot.figures[2]?.textContent;
    return { place, said, heads };
  }

  it('says both its pages, the chapter’s own as laid out (#67)', () => {
    const two = placed(SPREAD, 2);
    two.place.inSight(1000, 2200);
    expect(two.said()).toBe('pages 3–4 of 4');
    expect(two.heads.folio.textContent).toBe('34');
  });

  it('says one printed page where both begin on it, its folio once', () => {
    const print = [
      { label: '7', spine: 0, offset: 0 },
      { label: '8', spine: 0, offset: 2000 },
    ];
    const one = placed(
      [
        { role: 'text', from: 100 },
        { role: 'text', from: 900 },
      ],
      0,
      print,
    );
    one.place.inSight(100, 1400);
    expect(one.said()).toBe('page 7 of 8');
    expect(one.heads.folio.textContent).toBe('7');
  });

  it('says no page on the front matter, and numbers none of it', () => {
    const front = placed(FRONT);
    front.place.inSight(0, 0);
    expect(front.said()).toBe('');
    expect(front.heads.folio.textContent).toBe('');
  });
});

// QA (#40, Phase 3d): a spread whose verso holds no words (a plate) begins at
// the recto's first word, so a bookmark there is the recto's; and a last
// spread's empty recto marks nothing, its verso's mark at the left.
describe('a bookmark on a spread’s plate or its empty recto', () => {
  it('sits on the recto when the verso is a picture alone', () => {
    const plate = marked(
      [
        { role: 'text', from: 1600 },
        { role: 'text', from: 1600 },
      ],
      [at(1600)],
    );
    plate.marks.inSight(1600, 2200);
    expect(plate.page.bookmarked).toHaveBeenLastCalledWith(false, true);
  });

  it('sits on the verso of the chapter’s last spread, its recto empty', () => {
    const last = marked(
      [
        { role: 'text', from: 4000 },
        { role: 'blank', from: Number.POSITIVE_INFINITY },
      ],
      [at(4100)],
    );
    last.marks.inSight(4000, Number.POSITIVE_INFINITY);
    expect(last.page.bookmarked).toHaveBeenLastCalledWith(true, false);
    expect(last.marks.on).toBe(true);
  });
});

// QA (#40, Phase 3d): the imprint's figures are filled as its page comes into
// sight, the contents' rows for the chapters, and its pages once counted.
describe('the imprint’s figures', () => {
  function imprinted(sight: readonly PageShown[]) {
    const chapter = document.createElement('div');
    const epub = {
      title: 'Book',
      author: '',
      spine: [{ path: CHAPTER }, { path: 'two.xhtml' }],
      contents: [
        { title: 'One', spine: 0, depth: 0 },
        { title: 'Part', spine: 1, depth: 0 },
        { title: 'Two', spine: 1, depth: 1 },
      ],
    } as unknown as Epub;
    chapter.append(frontMatter(epub, 'Book.epub', ''));
    let count: BookCount | null = null;
    const place = bookPlace({
      page: {
        foot: new BookFoot(
          () => {},
          () => {},
        ),
        heads: new RunningHeads(),
        element: document.createElement('div'),
        chapter,
        sheet: { sight, paged: true, page: { at: 0, of: 4, per: 2 } },
      } as unknown as EpubPage,
      epub: () => epub,
      spine: () => 0,
      count: () => count,
      marks: () => [],
      goTo: () => {},
    });
    const length = () => chapter.querySelector('[data-imprint="length"]')?.textContent;
    /** Counted, a printed edition's pages in it where `print`. */
    const counted = (print = false) => {
      const pages = print ? [{ label: '212', spine: 1, offset: 0 }] : [];
      count = { lengths: [6000, 3000], print: pages } as unknown as BookCount;
      place.counted();
    };
    return { place, length, counted };
  }

  it('says the contents’ rows, and a printed edition’s pages (#67)', () => {
    const front = imprinted(FRONT);
    front.place.inSight(0, 0);
    expect(front.length()).toBe('3 chapters.');
    // A book with no page-list has no pages of its own to count: a chapter's are laid out, not kept.
    front.counted();
    expect(front.length()).toBe('3 chapters.');
    front.counted(true);
    expect(front.length()).toBe('3 chapters, 212 pages.');
  });

  it('is left alone while the book’s own pages are in sight', () => {
    const text = imprinted(SPREAD);
    text.place.inSight(1000, 2200);
    text.counted();
    expect(text.length()).toBe('');
  });
});
