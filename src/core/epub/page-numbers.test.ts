import { describe, expect, it } from 'vitest';
import {
  type PrintAt,
  pageOf,
  pageWords,
  printAt,
  printPages,
  STEADY_CHARS,
  steadyAt,
  steadyPages,
  steadyStart,
} from './page-numbers';

describe('steady pages, 1,500 characters of the book', () => {
  const lengths = [1000, 2500, 0, 1500];

  it('counts the book’s pages, at least one, once every item is counted', () => {
    expect(steadyPages(lengths)).toBe(4);
    expect(steadyPages([3000])).toBe(2);
    expect(steadyPages([])).toBe(1);
    expect(steadyPages([0, 0])).toBe(1);
    expect(steadyPages([1000, null])).toBeNull();
  });

  it('numbers a place by the characters before it in the book', () => {
    expect(steadyAt(lengths, 0, 0)).toBe(1);
    expect(steadyAt(lengths, 0, 999)).toBe(1);
    // 1,000 before it and 500 into the next: the second page begins.
    expect(steadyAt(lengths, 1, 500)).toBe(2);
    expect(steadyAt(lengths, 1, 2499)).toBe(3);
    expect(steadyAt(lengths, 3, 0)).toBe(3);
  });

  it('never numbers past the last page, at the book’s very end', () => {
    expect(steadyAt([3000], 0, 3000)).toBe(2);
    expect(steadyAt([3000], 0, 2999)).toBe(2);
    expect(steadyAt(lengths, 3, 1500)).toBe(4);
  });

  it('holds a place past its item’s end at its end', () => {
    expect(steadyAt([1000, 2000], 0, 99_999)).toBe(1);
  });

  it('numbers nothing until the book is counted, or for an item it hasn’t', () => {
    expect(steadyAt([1000, null], 0, 0)).toBeNull();
    expect(steadyAt(lengths, -1, 0)).toBeNull();
    expect(steadyAt(lengths, 4, 0)).toBeNull();
  });

  it('finds where a page begins', () => {
    expect(steadyStart(lengths, 1)).toEqual({ spine: 0, offset: 0 });
    expect(steadyStart(lengths, 2)).toEqual({ spine: 1, offset: STEADY_CHARS - 1000 });
    // 4,500 characters on: past items of 1,000, 2,500 and none, 1,000 into the last.
    expect(steadyStart(lengths, 4)).toEqual({ spine: 3, offset: 1000 });
    expect(steadyStart(lengths, 5)).toBeNull();
    expect(steadyStart(lengths, 0)).toBeNull();
    expect(steadyStart([], 1)).toEqual({ spine: 0, offset: 0 });
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

describe('a place’s page', () => {
  it('is the printed edition’s where the book has one, else steady', () => {
    const print = [{ label: '1', spine: 0, offset: 0 }];
    expect(pageOf({ lengths: [3000], print }, 0, 2000)).toEqual({ label: '1', of: 1 });
    expect(pageOf({ lengths: [3000], print: [] }, 0, 2000)).toEqual({ label: 2, of: 2 });
  });

  it('is said as the colophon says it', () => {
    expect(pageWords(212, 2450)).toBe('page 212 of 2,450');
    expect(pageWords(3, 1_204_000)).toBe('page 3 of 1,204,000');
    expect(pageWords('xii', null)).toBe('page xii');
    expect(pageWords('34', 412)).toBe('page 34 of 412');
    expect(pageWords(null, 9)).toBe('');
  });
});
