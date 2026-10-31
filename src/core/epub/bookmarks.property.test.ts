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

// QA (#40, Phase 4b): a file this Eien mustn't write is never written, whatever is asked of it.
describe('a reading file this Eien won’t write', () => {
  const change = fc.record(
    { add: bookmark, remove: fc.array(bookmark, { maxLength: 3 }) },
    { requiredKeys: [] },
  );

  it('a newer Eien’s is never written, by a bookmark or the place', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 1000 }),
        fc.array(bookmark, { maxLength: 5 }),
        change,
        (version, bookmarks, asked) => {
          const text = JSON.stringify({ version, bookmarks });
          expect(withBookmarks(text, asked)).toBeNull();
          expect(withReading(text, { chapter: 'a', offset: 0 })).toBeNull();
        },
      ),
    );
  });

  it('one that isn’t a JSON object (a sync broke it) is never written over', () => {
    /** A file cut short anywhere: never whole. */
    const cut = fc.array(bookmark, { minLength: 1, maxLength: 4 }).chain((bookmarks) => {
      const whole = JSON.stringify({ version: 1, bookmarks });
      return fc.integer({ min: 1, max: whole.length - 1 }).map((at) => whole.slice(0, at));
    });
    /** JSON, but not an object: a list, a string, a number, null. */
    const notObject = fc
      .jsonValue()
      .filter((value) => typeof value !== 'object' || value === null || Array.isArray(value))
      .map((value) => JSON.stringify(value));
    fc.assert(
      fc.property(fc.oneof(cut, notObject), change, (text, asked) => {
        expect(withBookmarks(text, asked)).toBeNull();
        expect(withReading(text, { chapter: 'a', offset: 0 })).toBeNull();
      }),
    );
  });
});
