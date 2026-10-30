import { describe, expect, it } from 'vitest';
import {
  type Bookmark,
  bookmarksOf,
  bookmarksOn,
  firstWords,
  inBookOrder,
  MAX_BOOKMARKS,
  withBookmarks,
} from './bookmarks';
import { parseReading, withReading } from './reading';

const mark = (chapter: string, offset: number, words = 'It is a truth'): Bookmark => ({
  chapter,
  offset,
  words,
});

describe('a book’s bookmarks in its reading state', () => {
  it('round-trips: added, read back, taken off', () => {
    const one = withBookmarks(null, { add: mark('a', 10) });
    expect(JSON.parse(one as string)).toEqual({
      version: 1,
      bookmarks: [{ chapter: 'a', offset: 10, words: 'It is a truth' }],
    });
    const two = withBookmarks(one, { add: mark('b', 0, 'Mr. Bennet') });
    expect(bookmarksOf(two)).toEqual([mark('a', 10), mark('b', 0, 'Mr. Bennet')]);
    // One already there isn't added twice.
    expect(bookmarksOf(withBookmarks(two, { add: mark('a', 10, 'other words') }))).toHaveLength(2);
    expect(bookmarksOf(withBookmarks(two, { remove: [mark('a', 10)] }))).toEqual([
      mark('b', 0, 'Mr. Bennet'),
    ]);
  });

  it('keeps the place, every field it doesn’t know, and every item it can’t read', () => {
    const text = JSON.stringify({
      version: 1,
      chapter: 'a',
      place: { chapter: 'a', offset: 3 },
      highlights: [{ from: 1 }],
      bookmarks: [
        { chapter: 'a', offset: 5, words: 'x', colour: 'ochre' },
        'a later kind of bookmark',
        { chapter: 'a', offset: -1 },
      ],
    });
    const after = JSON.parse(withBookmarks(text, { add: mark('b', 1), remove: [] }) as string);
    expect(after).toEqual({
      version: 1,
      chapter: 'a',
      place: { chapter: 'a', offset: 3 },
      highlights: [{ from: 1 }],
      bookmarks: [
        { chapter: 'a', offset: 5, words: 'x', colour: 'ochre' },
        'a later kind of bookmark',
        { chapter: 'a', offset: -1 },
        { chapter: 'b', offset: 1, words: 'It is a truth' },
      ],
    });
    expect(parseReading(withBookmarks(text, { remove: [mark('a', 5)] }))).toEqual({
      chapter: 'a',
      offset: 3,
    });
  });

  it('is kept by the place’s writes, which never touch it', () => {
    const text = withBookmarks(null, { add: mark('a', 10) });
    expect(bookmarksOf(withReading(text, { chapter: 'b', offset: 40 }))).toEqual([mark('a', 10)]);
  });

  it('never writes over a newer Eien’s file, or one it can’t read', () => {
    expect(withBookmarks('{ "version": 2 }', { add: mark('a', 1) })).toBeNull();
    expect(withBookmarks('{ not json', { add: mark('a', 1) })).toBeNull();
    expect(bookmarksOf('{ "version": 2, "bookmarks": [{ "chapter": "a", "offset": 4 }] }')).toEqual(
      [mark('a', 4, '')],
    );
  });

  it('reads a hostile file for what it can, and no more than a list shows', () => {
    for (const bookmarks of ['all', 7, null, { chapter: 'a' }])
      expect(bookmarksOf(JSON.stringify({ bookmarks })), JSON.stringify(bookmarks)).toEqual([]);
    const odd = [
      { chapter: 'a', offset: Number.NaN },
      { chapter: 'a', offset: 1e300 },
      { chapter: 'a', offset: 2.5 },
      { chapter: '', offset: 1 },
      { chapter: 3, offset: 1 },
      { chapter: 'a', offset: 1, words: 'w'.repeat(10_000) },
    ];
    const read = bookmarksOf(JSON.stringify({ bookmarks: odd }));
    expect(read).toHaveLength(1);
    expect(read[0]?.words.length).toBeLessThan(10_000);
    const many = Array.from({ length: 100_000 }, (_, i) => ({ chapter: 'a', offset: i }));
    const text = JSON.stringify({ bookmarks: many });
    expect(bookmarksOf(text)).toHaveLength(MAX_BOOKMARKS);
    // All of them kept in the file, though only the first are shown.
    const after = JSON.parse(withBookmarks(text, { add: mark('b', 0) }) as string);
    expect(after.bookmarks).toHaveLength(100_001);
  });
});

describe('the bookmarks on a page, and in the book’s order', () => {
  const marks = [mark('c2', 50), mark('c1', 900), mark('c1', 100), mark('gone', 0)];

  it('are those from its first word up to the next page’s', () => {
    expect(bookmarksOn(marks, 'c1', 100, 900)).toEqual([mark('c1', 100)]);
    expect(bookmarksOn(marks, 'c1', 101, Number.POSITIVE_INFINITY)).toEqual([mark('c1', 900)]);
    expect(bookmarksOn(marks, 'c3', 0, 1000)).toEqual([]);
  });

  it('on a page of no words (a picture’s), are those at the place it stands at', () => {
    expect(bookmarksOn(marks, 'c1', 100, 100)).toEqual([mark('c1', 100)]);
    expect(bookmarksOn(marks, 'c1', 101, 101)).toEqual([]);
  });

  it('run by chapter, then place, leaving out a chapter the book doesn’t have', () => {
    expect(inBookOrder(marks, ['c1', 'c2'])).toEqual([
      mark('c1', 100),
      mark('c1', 900),
      mark('c2', 50),
    ]);
  });
});

describe('a page’s first words', () => {
  it('are whole words, their space run together, an ellipsis where they go on', () => {
    expect(firstWords('  It is a\n truth ')).toBe('It is a truth');
    expect(firstWords('It is a truth universally acknowledged', 16)).toBe('It is a truth…');
    expect(firstWords('Unbroken'.repeat(20), 10)).toBe('UnbrokenUn…');
  });
});
