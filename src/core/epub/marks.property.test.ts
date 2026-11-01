// Over generated marks: ] from the book's start, as many times as there are
// marks, visits each once in the book's order, and [ walks them back.

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { marksInOrder, walkMarks } from './marks';

const SPINE = ['a', 'b', 'c'];

const bookmark = fc.record({
  chapter: fc.constantFrom(...SPINE),
  offset: fc.nat({ max: 400 }),
  words: fc.constant(''),
});
const highlight = fc
  .record({
    chapter: fc.constantFrom(...SPINE),
    from: fc.nat({ max: 400 }),
    length: fc.nat({ max: 30 }),
  })
  .map(({ chapter, from, length }) => ({ chapter, from, to: from + length + 1, words: '' }));

/** Marks at distinct places, so each is its own stop. */
const distinct = fc
  .tuple(fc.array(bookmark, { maxLength: 15 }), fc.array(highlight, { maxLength: 15 }))
  .map(([bookmarks, highlights]) => {
    const seen = new Set<string>();
    const fresh = (chapter: string, offset: number) => {
      const key = `${chapter}:${offset}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    };
    return {
      bookmarks: bookmarks.filter((each) => fresh(each.chapter, each.offset)),
      highlights: highlights.filter((each) => fresh(each.chapter, each.from)),
    };
  });

describe('walking the marks', () => {
  it('] visits every mark once, in order, from the book’s start; [ walks them back', () => {
    fc.assert(
      fc.property(distinct, ({ bookmarks, highlights }) => {
        const marks = marksInOrder(bookmarks, highlights, SPINE);
        let sight = { spine: 0, from: 0, to: 0 };
        const visited: number[] = [];
        for (let i = 0; i < marks.length; i++) {
          // Each mark's own word in sight, as a page showing it from there.
          const step = walkMarks(marks, i === 0 ? { spine: -1, from: 0, to: 0 } : sight, 1);
          if (!step) throw new Error('no mark');
          visited.push(step.index);
          sight = { spine: step.mark.spine, from: step.mark.offset, to: step.mark.offset + 1 };
        }
        expect(visited).toEqual(marks.map((_, i) => i));
        for (let i = marks.length - 1; i > 0; i--) {
          const back = walkMarks(marks, sight, -1);
          expect(back?.index).toBe(i - 1);
          if (back)
            sight = { spine: back.mark.spine, from: back.mark.offset, to: back.mark.offset + 1 };
        }
      }),
    );
  });
});

// QA (#40, Phase 5b): over any marks and any sight, not only a mark's own.
const anyMarks = fc.tuple(
  fc.array(bookmark, { maxLength: 15 }),
  fc.array(highlight, { maxLength: 15 }),
);
const sight = fc
  .record({
    spine: fc.integer({ min: -1, max: SPINE.length - 1 }),
    from: fc.nat({ max: 450 }),
    length: fc.oneof(fc.nat({ max: 120 }), fc.constant(Number.POSITIVE_INFINITY)),
  })
  .map(({ spine, from, length }) => ({ spine, from, to: from + length }));
/** Whether `a` begins before (`spine`, `offset`) in the book. */
const isBefore = (a: { spine: number; offset: number }, spine: number, offset: number) =>
  a.spine < spine || (a.spine === spine && a.offset < offset);

describe('the marks in the book’s order, and a walk from any sight', () => {
  it('are every mark in the book, once, by chapter, then word, a bookmark first at one', () => {
    fc.assert(
      fc.property(anyMarks, ([bookmarks, highlights]) => {
        const marks = marksInOrder(bookmarks, highlights, SPINE.slice(0, 2));
        const inBook = (chapter: string) => chapter !== 'c';
        expect(marks).toHaveLength(
          bookmarks.filter((each) => inBook(each.chapter)).length +
            highlights.filter((each) => inBook(each.chapter)).length,
        );
        // Each in the book before the next, or at its word with a bookmark first.
        const rank = (mark: (typeof marks)[number]) =>
          (mark.spine * 1000 + mark.offset) * 2 + (mark.kind === 'bookmark' ? 0 : 1);
        const ranks = marks.map(rank);
        expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
      }),
    );
  });

  it('] goes to the first mark not before the words after those in sight, [ to the last before them, round past either end', () => {
    fc.assert(
      fc.property(anyMarks, sight, ([bookmarks, highlights], at) => {
        const marks = marksInOrder(bookmarks, highlights, SPINE);
        const on = walkMarks(marks, at, 1);
        const back = walkMarks(marks, at, -1);
        if (marks.length === 0) {
          expect(on).toBeNull();
          expect(back).toBeNull();
          return;
        }
        // A page of no words is its own word.
        const end = Math.max(at.to, at.from + 1);
        const next = marks.findIndex((mark) => !isBefore(mark, at.spine, end));
        expect(on).toMatchObject(
          next >= 0 ? { index: next, round: false } : { index: 0, round: true },
        );
        expect(on?.mark).toBe(marks[on?.index ?? -1]);
        const last = marks.findLastIndex((mark) => isBefore(mark, at.spine, at.from));
        expect(back).toMatchObject(
          last >= 0 ? { index: last, round: false } : { index: marks.length - 1, round: true },
        );
        // Never a mark in sight, unless round to it from a book whose every mark is.
        for (const step of [on, back])
          if (step && !step.round) {
            const inSight =
              step.mark.spine === at.spine && step.mark.offset >= at.from && step.mark.offset < end;
            expect(inSight).toBe(false);
          }
      }),
    );
  });
});
