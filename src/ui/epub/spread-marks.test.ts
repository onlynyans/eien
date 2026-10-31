// A book's bookmarks and its page numbers on a spread (#40, Phase 3d): the
// mark sits on the page it marks, B marks the spread's first word and takes
// off every bookmark on its two pages, the colophon says both pages, and
// Eien's front matter has nothing to mark or number.

import { describe, expect, it, vi } from 'vitest';
import type { Bookmark, Epub } from '../../core/epub';
import type { BookCount } from './book-count';
import { BookFoot } from './book-foot';
import { bookPlace } from './book-place';
import type { EpubPage } from './epub-page';
import { PageBookmarks } from './page-bookmarks';
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
  const mark = vi.fn(async (_key: string, change: { add?: Bookmark; remove?: Bookmark[] }) =>
    change.add ? [...kept, change.add] : kept.filter((one) => !change.remove?.includes(one)),
  );
  const marks = new PageBookmarks({
    page: page as never,
    store: { listen: () => () => {}, mark } as never,
    chapter: () => CHAPTER,
    still: (then) => then(),
    land: () => {},
    changed: () => {},
    listed: () => {},
  });
  marks.opened('k', { reading: { chapter: null, offset: 0 }, bookmarks: kept, kept: 'kept' });
  return { marks, page, mark };
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
    expect(none.mark).toHaveBeenLastCalledWith('k', {
      add: expect.objectContaining({ chapter: CHAPTER, offset: 1000 }),
    });
    const two = [at(1100), at(1900)];
    const some = marked(SPREAD, two);
    some.marks.inSight(1000, 2200);
    await some.marks.toggle();
    expect(some.mark).toHaveBeenLastCalledWith('k', { remove: two });
  });

  it('is never made on the front matter, which holds none of the book’s words', async () => {
    const front = marked(FRONT, [at(0)]);
    front.marks.inSight(0, 0);
    expect(front.page.bookmarked).toHaveBeenLastCalledWith(false, false);
    await front.marks.toggle();
    expect(front.mark).not.toHaveBeenCalled();
  });
});

describe('a spread’s pages in the colophon', () => {
  /** A book's place over a page whose sight is `sight`, its count steady pages of 6,000 characters. */
  function placed(sight: readonly PageShown[]) {
    const foot = new BookFoot(() => {});
    const heads = new RunningHeads();
    const place = bookPlace({
      page: {
        foot,
        heads,
        element: document.createElement('div'),
        chapter: document.createElement('div'),
        sheet: { sight },
      } as unknown as EpubPage,
      epub: () => ({ title: 'Book', spine: [{ path: CHAPTER }], contents: [] }) as unknown as Epub,
      spine: () => 0,
      count: () => ({ lengths: [6000], print: [] }) as unknown as BookCount,
      marks: () => [],
      goTo: () => {},
    });
    const said = () => foot.figures[2]?.textContent;
    return { place, said, heads };
  }

  it('says both its pages, or one where both begin on it', () => {
    const two = placed(SPREAD);
    two.place.inSight(1000, 2200);
    expect(two.said()).toBe('pages 1–2 of 4');
    expect(two.heads.folio.textContent).toBe('12');
    const one = placed([
      { role: 'text', from: 100 },
      { role: 'text', from: 900 },
    ]);
    one.place.inSight(100, 1400);
    expect(one.said()).toBe('page 1 of 4');
  });

  it('says no page on the front matter, and numbers none of it', () => {
    const front = placed(FRONT);
    front.place.inSight(0, 0);
    expect(front.said()).toBe('');
    expect(front.heads.folio.textContent).toBe('');
  });
});
