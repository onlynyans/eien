import { describe, expect, it } from 'vitest';
import type { Epub } from '../../core/epub';
import type { BookCount } from './book-count';
import { BookFoot } from './book-foot';
import { bookPlace } from './book-place';
import type { EpubPage } from './epub-page';
import { RunningHeads } from './running-heads';

/** A book's place over a foot, its count steady pages of a book of 4,500 characters in one chapter. */
function placed() {
  const foot = new BookFoot(() => {});
  const count = { lengths: [4500], print: [] } as unknown as BookCount;
  const place = bookPlace({
    page: {
      foot,
      element: document.createElement('div'),
      sheet: { sight: [] },
      heads: new RunningHeads(),
    } as unknown as EpubPage,
    epub: () => ({ spine: [], contents: [] }) as unknown as Epub,
    spine: () => 0,
    count: () => count,
    marks: () => [],
    goTo: () => {},
  });
  const said = () => foot.figures[2]?.textContent;
  return { place, said };
}

describe('the page a book’s place says', () => {
  it('follows the words in sight', () => {
    const { place, said } = placed();
    place.inSight(1600, 2000);
    expect(said()).toBe('page 2 of 3');
  });

  it('says nothing until the chapter drawn has its words in sight measured, however much is counted', () => {
    const { place, said } = placed();
    place.counted();
    expect(said()).toBe('');
    place.inSight(0, 100);
    place.clear();
    expect(said()).toBe('');
    // More of the book counted meanwhile: still nothing over a chapter not yet in sight, or refused.
    place.counted();
    expect(said()).toBe('');
  });
});

describe('a page a bookmark is on, as its row says it', () => {
  it('is none known for a printed book’s chapter not yet counted, never the page before it', () => {
    const foot = new BookFoot(() => {});
    const count = {
      lengths: [1000, null],
      print: [
        { label: '1', spine: 0, offset: 0 },
        { label: '2', spine: 1, offset: null },
      ],
    } as unknown as BookCount;
    const place = bookPlace({
      page: {
        foot,
        element: document.createElement('div'),
        sheet: { sight: [] },
        heads: new RunningHeads(),
      } as unknown as EpubPage,
      epub: () => ({ spine: [], contents: [] }) as unknown as Epub,
      spine: () => 0,
      count: () => count,
      marks: () => [],
      goTo: () => {},
    });
    expect(place.labelAt(0, 500)).toBe('1');
    expect(place.labelAt(1, 10)).toBeNull();
  });

  /** A book's place whose count is `count` (null: no book counted at all). */
  const placeOver = (count: unknown) =>
    bookPlace({
      page: {
        foot: new BookFoot(() => {}),
        element: document.createElement('div'),
        sheet: { sight: [] },
        heads: new RunningHeads(),
      } as unknown as EpubPage,
      epub: () => ({ spine: [], contents: [] }) as unknown as Epub,
      spine: () => 0,
      count: () => count as BookCount | null,
      marks: () => [],
      goTo: () => {},
    });

  it('is none known for a book with no page-list until every chapter is counted, in any chapter: never a guess', () => {
    // A steady page needs the book's whole length: the first chapter counted still isn't enough.
    const partly = placeOver({ lengths: [4500, null, 3000], print: [] });
    expect(partly.labelAt(0, 0)).toBeNull();
    expect(partly.labelAt(0, 3000)).toBeNull();
    expect(partly.labelAt(2, 0)).toBeNull();
    const whole = placeOver({ lengths: [4500, 1500, 3000], print: [] });
    expect(whole.labelAt(0, 3000)).toBe('3');
    expect(whole.labelAt(2, 0)).toBe('5');
    // A place past its chapter's end (the count and the book disagreeing) stands at its end.
    expect(whole.labelAt(0, 1_000_000)).toBe('4');
  });

  it('is none known with no count yet, nor before a printed book’s first page', () => {
    expect(placeOver(null).labelAt(0, 0)).toBeNull();
    const print = placeOver({
      lengths: [200, 1000],
      print: [{ label: 'xii', spine: 1, offset: 0 }],
    });
    // The cover, before the printed edition begins.
    expect(print.labelAt(0, 100)).toBeNull();
    expect(print.labelAt(1, 0)).toBe('xii');
  });
});
