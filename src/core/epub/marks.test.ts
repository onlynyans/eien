import { describe, expect, it } from 'vitest';
import type { Bookmark } from './bookmarks';
import type { Highlight } from './highlights';
import { BEFORE_WORDS, type Mark, marksInOrder, walkMarks } from './marks';

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

// QA (#40, Phase 5b): the sights a page gives that the walk must read as the
// page does: a chapter's last page (in pages, its words run to the chapter's
// end), a spread's two pages as one sight, and two kinds at one word.
describe('] and [ from the sights a page gives, as QA tried them', () => {
  const marks = marksInOrder(
    [bookmark(0, 1000), bookmark(1, 0)],
    [highlight(0, 1600), highlight(0, 2500)],
    SPINE,
  );

  it('passes over a mark on a spread’s recto: the two pages are one sight', () => {
    // The verso from 1000, the recto from 1600, the next spread from 2200.
    const spread = { spine: 0, from: 1000, to: 2200 };
    expect(where(walkMarks(marks, spread, 1)?.mark)).toBe('highlight 0:2500');
    expect(walkMarks(marks, spread, -1)).toMatchObject({ index: 3, round: true });
  });

  it('goes on to the next chapter from a chapter’s last page, whose words run to its end', () => {
    const last = { spine: 0, from: 2400, to: Number.POSITIVE_INFINITY };
    expect(where(walkMarks(marks, last, 1)?.mark)).toBe('bookmark 1:0');
    expect(where(walkMarks(marks, last, -1)?.mark)).toBe('highlight 0:1600');
  });

  it('takes a bookmark and a highlight at one word as one stop each, the bookmark first', () => {
    const both = marksInOrder([bookmark(1, 30)], [highlight(1, 30)], SPINE);
    const before = { spine: 1, from: 0, to: 10 };
    expect(walkMarks(both, before, 1)?.mark.kind).toBe('bookmark');
    const after = { spine: 1, from: 200, to: 300 };
    expect(walkMarks(both, after, -1)?.mark.kind).toBe('highlight');
  });

  it('says the one mark of a book round from itself, either way', () => {
    const one = marksInOrder([bookmark(1, 30)], [], SPINE);
    const on = { spine: 1, from: 30, to: 60 };
    expect(walkMarks(one, on, 1)).toMatchObject({ index: 0, round: true });
    expect(walkMarks(one, on, -1)).toMatchObject({ index: 0, round: true });
  });
});

// Phase 5b's QA: on Eien's title page no word of the chapter is in sight yet.
describe('] from before a chapter’s first word', () => {
  it('lands on a mark at the chapter’s very first word, not past it', () => {
    const marks = marksInOrder([bookmark(0, 0), bookmark(0, 500)], [], SPINE);
    expect(walkMarks(marks, { spine: 0, ...BEFORE_WORDS }, 1)).toMatchObject({
      index: 0,
      round: false,
    });
    expect(walkMarks(marks, { spine: 0, ...BEFORE_WORDS }, -1)).toMatchObject({ round: true });
  });
});
