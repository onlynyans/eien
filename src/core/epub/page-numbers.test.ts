import { describe, expect, it } from 'vitest';
import {
  bookWords,
  chapterWords,
  type PrintAt,
  pageWords,
  placeLabel,
  placeWords,
  printAt,
  printPages,
  shareAt,
  spreadWords,
} from './page-numbers';

/** Three chapters in the reading order, of equal size, and a fourth out of it (a note). */
const SPINE = [
  { linear: true, size: 1000 },
  { linear: true, size: 1000 },
  { linear: true, size: 1000 },
  { linear: false, size: 1000 },
];

describe('a place in a book with no printed pages (#67)', () => {
  const count = { lengths: [400, 1000, 0, 200], print: [] };

  it('is named by how far through the book it is, by its chapter’s words', () => {
    expect(placeLabel(count, SPINE, 0, 0)).toBe('0%');
    // Half of the first of three chapters.
    expect(placeLabel(count, SPINE, 0, 200)).toBe('16%');
    expect(placeLabel(count, SPINE, 1, 500)).toBe('50%');
    expect(placeLabel(count, SPINE, 2, 0)).toBe('66%');
    expect(placeWords(count, SPINE, 1, 500)).toBe('50% of the book');
  });

  it('is the same share the colophon and the strip go by', () => {
    expect(shareAt(SPINE, count.lengths, 1, 500)).toBeCloseTo(0.5);
    // A chapter of no words: its start.
    expect(shareAt(SPINE, count.lengths, 2, 10)).toBeCloseTo(2 / 3);
    // Past its chapter's end (the window and the count disagreeing): its end, never past the book's.
    expect(shareAt(SPINE, count.lengths, 2, Number.POSITIVE_INFINITY)).toBeLessThanOrEqual(1);
    expect(shareAt(SPINE, count.lengths, 1, 99_999)).toBeCloseTo(2 / 3);
  });

  it('is named nothing until its chapter is counted, or for a chapter the book hasn’t', () => {
    expect(placeLabel({ lengths: [400, null], print: [] }, SPINE, 1, 10)).toBeNull();
    expect(placeWords({ lengths: [400, null], print: [] }, SPINE, 1, 10)).toBe('');
    expect(shareAt(SPINE, [400], 5, 0)).toBeNull();
    // Only its own chapter: the rest of the book uncounted doesn't hold it back.
    expect(placeLabel({ lengths: [null, 1000, null], print: [] }, SPINE, 1, 500)).toBe('50%');
  });

  it('says how far through the chapter or the book as the colophon does', () => {
    expect(bookWords(0.214)).toBe('21% of the book');
    expect(bookWords(1)).toBe('100% of the book');
    expect(chapterWords(0.4)).toBe('40% of the chapter');
    expect(chapterWords(0.999)).toBe('99% of the chapter');
  });
});

describe('the printed edition’s pages', () => {
  const pages: PrintAt[] = [
    { label: 'xii', spine: 0, offset: 0 },
    { label: '1', spine: 0, offset: 120 },
    { label: '2', spine: 1, offset: 0 },
    { label: '3', spine: 1, offset: 70 },
    // Its place lost from its chapter.
    { label: '4', spine: 2, offset: null },
    { label: '5', spine: 2, offset: 90 },
  ];

  it('names the last page to begin at or before the place', () => {
    expect(printAt(pages, 0, 0)).toBe('xii');
    expect(printAt(pages, 0, 119)).toBe('xii');
    expect(printAt(pages, 0, 120)).toBe('1');
    expect(printAt(pages, 1, 69)).toBe('2');
    expect(printAt(pages, 1, 500)).toBe('3');
  });

  it('takes the last page of the items before when its own has none yet, a lost page counting for nothing', () => {
    expect(printAt(pages, 2, 0)).toBe('3');
    expect(printAt(pages, 2, 89)).toBe('3');
    expect(printAt(pages, 2, 90)).toBe('5');
    // A chapter not yet counted: its own pages unknown, the order of those before still says.
    expect(
      printAt(
        [
          { label: '7', spine: 0, offset: 0 },
          { label: '8', spine: 1, offset: null },
        ],
        3,
        0,
      ),
    ).toBe('8');
  });

  it('takes the later of two pages beginning at one place', () => {
    expect(
      printAt(
        [
          { label: 'A', spine: 0, offset: 10 },
          { label: 'B', spine: 0, offset: 10 },
        ],
        0,
        10,
      ),
    ).toBe('B');
  });

  it('names nothing before the first printed page', () => {
    expect(printAt([{ label: '1', spine: 1, offset: 0 }], 0, 50)).toBeNull();
    expect(printAt([{ label: '1', spine: 0, offset: 40 }], 0, 39)).toBeNull();
  });

  it('counts the printed pages by the last one’s number, or not at all', () => {
    expect(printPages(pages)).toBe(5);
    expect(printPages([{ label: 'xii', spine: 0, offset: 0 }])).toBeNull();
    expect(printPages([])).toBeNull();
  });
});

describe('a place’s page, as the colophon says it', () => {
  it('is said as the colophon says it, a printed page or the chapter’s own (#67)', () => {
    expect(pageWords(212, 2450)).toBe('page 212 of 2,450');
    expect(pageWords(3, 1_204_000)).toBe('page 3 of 1,204,000');
    expect(pageWords('xii', null)).toBe('page xii');
    expect(pageWords('34', 412)).toBe('page 34 of 412');
    expect(pageWords(null, 9)).toBe('');
    // The chapter's own pages, as laid out: the last of them.
    expect(pageWords('12', 12)).toBe('page 12 of 12');
  });

  it('is the printed one in a printed book, at once, wherever it is', () => {
    const print = [{ label: '1', spine: 0, offset: 0 }];
    expect(placeLabel({ lengths: [3000], print }, SPINE, 0, 2000)).toBe('1');
    expect(placeWords({ lengths: [3000], print }, SPINE, 0, 2000)).toBe('page 1 of 1');
  });

  it('says a spread’s two pages, or one where both begin on the same page (Phase 3d)', () => {
    expect(spreadWords(212, 213, 2450)).toBe('pages 212–213 of 2,450');
    expect(spreadWords(212, 212, 2450)).toBe('page 212 of 2,450');
    expect(spreadWords('xi', 'xii', null)).toBe('pages xi–xii');
    expect(spreadWords('7', 7, 9)).toBe('page 7 of 9');
    expect(spreadWords(212, null, 2450)).toBe('page 212 of 2,450');
    expect(spreadWords(null, 3, 9)).toBe('');
  });
});

describe('a book’s printed pages at its edges', () => {
  it('has no count of pages when its labels aren’t numbers, each still said', () => {
    const roman: PrintAt[] = [
      { label: 'i', spine: 0, offset: 0 },
      { label: 'ii', spine: 0, offset: 50 },
      { label: 'iii', spine: 1, offset: 0 },
    ];
    expect(printPages(roman)).toBeNull();
    expect(placeWords({ lengths: [100, 100], print: roman }, SPINE, 1, 10)).toBe('page iii');
    // Numbers, then a last page that isn't one (an index's "A-1"): no count, as the last says.
    expect(
      printPages([
        { label: '1', spine: 0, offset: 0 },
        { label: 'A-1', spine: 0, offset: 10 },
      ]),
    ).toBeNull();
  });

  it('says the printed page before the book is counted: it needs only the drawn chapter', () => {
    const print: PrintAt[] = [
      { label: '1', spine: 0, offset: 0 },
      { label: '2', spine: 1, offset: 40 },
    ];
    // Nothing counted but the chapter drawn (item 1).
    expect(placeLabel({ lengths: [null, 300, null], print }, SPINE, 1, 50)).toBe('2');
    expect(placeWords({ lengths: [null, 300, null], print }, SPINE, 1, 50)).toBe('page 2 of 2');
  });

  it('never falls back to how far through the book before the first printed page', () => {
    const print: PrintAt[] = [{ label: '1', spine: 1, offset: 0 }];
    expect(placeLabel({ lengths: [3000, 3000], print }, SPINE, 0, 2000)).toBeNull();
    expect(placeWords({ lengths: [3000, 3000], print }, SPINE, 0, 2000)).toBe('');
  });

  it('names nothing in a printed book’s chapter not yet counted: the page before would be wrong', () => {
    const print: PrintAt[] = [
      { label: '1', spine: 0, offset: 0 },
      { label: '2', spine: 1, offset: null },
    ];
    expect(placeLabel({ lengths: [100, null], print }, SPINE, 1, 50)).toBeNull();
  });
});

// QA (#40, Phase 3d): a spread's two pages as a long book and a printed one say them.
describe('a spread’s pages, the edges', () => {
  it('groups both pages’ thousands, and joins a number and a printed label', () => {
    expect(spreadWords(1999, 2000, 2450)).toBe('pages 1,999–2,000 of 2,450');
    expect(spreadWords(1999, 2000, null)).toBe('pages 1,999–2,000');
    expect(spreadWords('xii', 1, 300)).toBe('pages xii–1 of 300');
  });

  it('says one page where the recto’s is the verso’s, whatever its kind, or isn’t known', () => {
    expect(spreadWords('xi', 'xi', null)).toBe('page xi');
    expect(spreadWords(1200, '1200', 2450)).toBe('page 1,200 of 2,450');
    expect(spreadWords('xi', null, null)).toBe('page xi');
    expect(spreadWords(null, null, 9)).toBe('');
  });
});
