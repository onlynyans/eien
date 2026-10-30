import { describe, expect, it } from 'vitest';
import type { Epub } from '../../core/epub';
import type { BookCount } from './book-count';
import { BookFoot } from './book-foot';
import { bookPlace } from './book-place';
import type { EpubPage } from './epub-page';

/** A book's place over a foot, its count steady pages of a book of 4,500 characters in one chapter. */
function placed() {
  const foot = new BookFoot(() => {});
  const count = { lengths: [4500], print: [] } as unknown as BookCount;
  const place = bookPlace({
    page: { foot, element: document.createElement('div') } as unknown as EpubPage,
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
      page: { foot, element: document.createElement('div') } as unknown as EpubPage,
      epub: () => ({ spine: [], contents: [] }) as unknown as Epub,
      spine: () => 0,
      count: () => count,
      marks: () => [],
      goTo: () => {},
    });
    expect(place.labelAt(0, 500)).toBe('1');
    expect(place.labelAt(1, 10)).toBeNull();
  });
});
