// Over generated highlights and words chosen: H never leaves two that
// overlap in a chapter, a highlight taken off and put back is as it was,
// and H twice on words that touch none leaves the list as it was.

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  type Highlight,
  highlightsIn,
  highlightsOf,
  pressHighlight,
  type Span,
  sameHighlight,
  withHighlights,
  withRestored,
} from './highlights';

const CHAPTERS = ['a', 'b'];

const span: fc.Arbitrary<Span> = fc
  .tuple(fc.nat({ max: 500 }), fc.integer({ min: 1, max: 80 }))
  .map(([from, length]) => ({ from, to: from + length }));

const chosen = fc.record({ chapter: fc.constantFrom(...CHAPTERS), span });

/** The file after H on `span` in `chapter`, as the window runs it (core's own `pressHighlight`). */
const pressH = (text: string | null, chapter: string, words: Span): string | null =>
  pressHighlight(text, chapter, words, () => '').text;

const overlapping = (list: readonly Highlight[]) =>
  list.some((one, i) =>
    list.some((other, j) => i < j && one.from < other.to && other.from < one.to),
  );

describe('H over any highlights', () => {
  it('never leaves two that overlap in a chapter', () => {
    fc.assert(
      fc.property(fc.array(chosen, { maxLength: 30 }), (presses) => {
        let text: string | null = null;
        for (const press of presses) text = pressH(text, press.chapter, press.span);
        const list = highlightsOf(text);
        for (const chapter of CHAPTERS)
          expect(overlapping(highlightsIn(list, chapter))).toBe(false);
      }),
    );
  });

  it('twice on words that touch no highlight leaves the list as it was', () => {
    fc.assert(
      fc.property(fc.array(chosen, { maxLength: 12 }), chosen, (presses, press) => {
        let text: string | null = null;
        for (const each of presses) text = pressH(text, each.chapter, each.span);
        const before = highlightsOf(text);
        const touched = highlightsIn(before, press.chapter).some(
          (each) => each.from <= press.span.to && press.span.from <= each.to,
        );
        if (touched) return;
        const twice = pressH(pressH(text, press.chapter, press.span), press.chapter, press.span);
        expect(highlightsOf(twice)).toEqual(before);
      }),
    );
  });

  it('a highlight taken off, put back, is as it was, and putting back what’s held changes nothing', () => {
    fc.assert(
      fc.property(fc.array(chosen, { minLength: 1, maxLength: 12 }), fc.nat(), (presses, pick) => {
        let text: string | null = null;
        for (const each of presses) text = pressH(text, each.chapter, each.span);
        const before = highlightsOf(text);
        const gone = before[pick % Math.max(1, before.length)];
        if (!gone) return;
        const off = withHighlights(text, { remove: [gone] });
        expect(highlightsOf(off).some((each) => sameHighlight(each, gone))).toBe(false);
        const back = highlightsOf(withRestored(off, gone));
        expect(back).toHaveLength(before.length);
        expect(back).toEqual(expect.arrayContaining(before));
        expect(highlightsOf(withRestored(withRestored(off, gone), gone))).toEqual(back);
      }),
    );
  });
});
