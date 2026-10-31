import { describe, expect, it } from 'vitest';
import type { Bookmark } from './bookmarks';
import type { Highlight } from './highlights';
import { type Mark, marksInOrder, walkMarks } from './marks';

const SPINE = ['c0.xhtml', 'c1.xhtml', 'c2.xhtml'];
const bookmark = (chapter: number, offset: number): Bookmark => ({
  chapter: SPINE[chapter] as string,
  offset,
  words: '',
});
const highlight = (chapter: number, from: number, to = from + 5): Highlight => ({
  chapter: SPINE[chapter] as string,
  from,
  to,
  words: '',
});
const where = (mark: Mark | undefined) => mark && `${mark.kind} ${mark.spine}:${mark.offset}`;

describe('a book’s marks in its order', () => {
  it('runs by chapter in the reading order, then by word, a bookmark first at one word', () => {
    const marks = marksInOrder(
      [bookmark(2, 0), bookmark(0, 50)],
      [highlight(0, 50), highlight(0, 10), highlight(1, 0)],
      SPINE,
    );
    expect(marks.map(where)).toEqual([
      'highlight 0:10',
      'bookmark 0:50',
      'highlight 0:50',
      'highlight 1:0',
      'bookmark 2:0',
    ]);
  });

  it('leaves out a mark whose chapter isn’t in the book', () => {
    const gone = { ...highlight(0, 1), chapter: 'gone.xhtml' };
    expect(marksInOrder([{ ...bookmark(0, 1), chapter: 'gone.xhtml' }], [gone], SPINE)).toEqual([]);
  });
});

describe('] and [ walking the marks', () => {
  const marks = marksInOrder(
    [bookmark(0, 100), bookmark(2, 0)],
    [highlight(0, 10), highlight(1, 40)],
    SPINE,
  );

  it('] goes to the first past the words in sight, [ to the last before them', () => {
    const sight = { spine: 0, from: 50, to: 150 };
    expect(where(walkMarks(marks, sight, 1)?.mark)).toBe('highlight 1:40');
    expect(where(walkMarks(marks, sight, -1)?.mark)).toBe('highlight 0:10');
  });

  it('passes over a mark in sight, either way', () => {
    const sight = { spine: 0, from: 90, to: 110 };
    expect(walkMarks(marks, sight, 1)?.index).toBe(2);
    expect(walkMarks(marks, sight, -1)?.index).toBe(0);
  });

  it('goes round the book past either end, and says so', () => {
    expect(walkMarks(marks, { spine: 2, from: 0, to: 300 }, 1)).toMatchObject({
      index: 0,
      round: true,
    });
    expect(walkMarks(marks, { spine: 0, from: 0, to: 5 }, -1)).toMatchObject({
      index: 3,
      round: true,
    });
  });

  it('counts a page of no words as its own word, so ] leaves it', () => {
    // A picture's page: its words in sight begin and end at one offset.
    const picture = marksInOrder([bookmark(1, 40)], [highlight(1, 41)], SPINE);
    expect(where(walkMarks(picture, { spine: 1, from: 40, to: 40 }, 1)?.mark)).toBe(
      'highlight 1:41',
    );
  });

  it('finds none in a book with no marks', () => {
    expect(walkMarks([], { spine: 0, from: 0, to: 10 }, 1)).toBeNull();
  });
});
