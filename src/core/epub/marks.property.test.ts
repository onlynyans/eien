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
