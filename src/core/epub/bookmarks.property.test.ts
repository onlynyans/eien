// Over generated reading files: a bookmark added then taken off leaves the
// bookmarks as they were, and the place's writes never drop them.

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { type Bookmark, bookmarksOf, sameMark, withBookmarks } from './bookmarks';
import { withReading } from './reading';

const bookmark: fc.Arbitrary<Bookmark> = fc.record({
  chapter: fc.constantFrom('a', 'b', 'c'),
  offset: fc.nat({ max: 5000 }),
  words: fc.string({ maxLength: 20 }),
});

/** A file of this version's: bookmarks among items it can't read, and a field it doesn't know. */
const file = fc
  .tuple(
    fc.array(fc.oneof(bookmark, fc.anything()), { maxLength: 12 }),
    fc.option(fc.record({ chapter: fc.constant('a'), offset: fc.nat() }), { nil: undefined }),
  )
  .map(([bookmarks, place]) =>
    JSON.stringify({ version: 1, place, later: { kept: true }, bookmarks }),
  );

describe('bookmarks over any file', () => {
  it('one added and taken off leaves them as they were', () => {
    fc.assert(
      fc.property(file, bookmark, (text, added) => {
        const before = bookmarksOf(text);
        if (before.some((mark) => sameMark(mark, added))) return;
        const on = withBookmarks(text, { add: added }) as string;
        expect(bookmarksOf(on)).toContainEqual(added);
        const off = withBookmarks(on, { remove: [added] }) as string;
        expect(bookmarksOf(off)).toEqual(before);
        expect(JSON.parse(off).later).toEqual({ kept: true });
      }),
    );
  });

  it('are never dropped by the place’s writes', () => {
    fc.assert(
      fc.property(file, fc.nat(), (text, offset) => {
        const after = withReading(text, { chapter: 'b', offset });
        expect(JSON.parse(after as string).bookmarks).toEqual(JSON.parse(text).bookmarks);
      }),
    );
  });
});
