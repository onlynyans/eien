import { describe, expect, it } from 'vitest';
import { bookmarksOf, withBookmarks } from './bookmarks';
import {
  HIGHLIGHT_WORDS,
  type Highlight,
  highlightChange,
  highlightsOf,
  MAX_HIGHLIGHTS,
  withHighlights,
} from './highlights';
import { parseReading, withReading } from './reading';

const at = (from: number, to: number, chapter = 'c1.xhtml'): Highlight => ({
  chapter,
  from,
  to,
  words: `words ${from}`,
});
const file = (fields: object) => JSON.stringify({ version: 1, ...fields });

describe('a book’s highlights in its reading file', () => {
  it('are added, once, and taken off, in the file’s own list', () => {
    const one = withHighlights(null, { add: at(5, 20) });
    expect(highlightsOf(one)).toEqual([at(5, 20)]);
    expect(withHighlights(one, { add: at(5, 20) })).toBe(one);
    expect(highlightsOf(withHighlights(one, { remove: [at(5, 20)] }))).toEqual([]);
  });

  it('keep an item this Eien can’t read and a field it doesn’t know, and leave the place and bookmarks be', () => {
    const before = file({
      chapter: 'c1.xhtml',
      place: { chapter: 'c1.xhtml', offset: 40 },
      bookmarks: [{ chapter: 'c1.xhtml', offset: 3, words: 'w' }],
      highlights: [{ ...at(1, 2), colour: 'yellow' }, 'a later kind'],
      theirs: true,
    });
    const after = withHighlights(before, { add: at(7, 9) }) as string;
    const kept = JSON.parse(after);
    expect(kept.highlights).toEqual([{ ...at(1, 2), colour: 'yellow' }, 'a later kind', at(7, 9)]);
    expect(kept.theirs).toBe(true);
    expect(parseReading(after)).toEqual({ chapter: 'c1.xhtml', offset: 40 });
    expect(bookmarksOf(after)).toEqual(bookmarksOf(before));
  });

  it('are never dropped by the place’s writes nor a bookmark’s', () => {
    const before = withHighlights(null, { add: at(1, 4) });
    const placed = withReading(before, { chapter: 'c2.xhtml', offset: 9 });
    const marked = withBookmarks(placed, { add: { chapter: 'c2.xhtml', offset: 9, words: '' } });
    expect(highlightsOf(marked)).toEqual([at(1, 4)]);
  });

  it('never write over a newer Eien’s file, nor one that can’t be read', () => {
    expect(withHighlights(file({ version: 2 }), { add: at(1, 2) })).toBeNull();
    expect(withHighlights('{ "highlights": [', { add: at(1, 2) })).toBeNull();
  });

  it('read only what they can: a list, items with a chapter and a run of words', () => {
    expect(highlightsOf(file({ highlights: 'none' }))).toEqual([]);
    const items = [
      at(1, 2),
      { chapter: '', from: 1, to: 2 },
      { chapter: 'c', from: 2, to: 2 },
      { chapter: 'c', from: 3, to: 1 },
      { chapter: 'c', from: -1, to: 4 },
      { chapter: 'c', from: Number.NaN, to: 4 },
      { chapter: 'c', from: 1, to: 2 ** 60 },
      { chapter: 'c', from: '1', to: 4 },
      null,
      { chapter: 'c', from: 0, to: 1 },
    ];
    expect(highlightsOf(file({ highlights: items }))).toEqual([
      at(1, 2),
      { chapter: 'c', from: 0, to: 1, words: '' },
    ]);
  });

  it('show the first of a list too long, and keep another Eien’s long words cut', () => {
    const many = Array.from({ length: MAX_HIGHLIGHTS + 5 }, (_, i) => at(i, i + 1));
    expect(highlightsOf(file({ highlights: many }))).toHaveLength(MAX_HIGHLIGHTS);
    const long = { ...at(1, 2), words: 'w'.repeat(HIGHLIGHT_WORDS * 10) };
    expect(highlightsOf(file({ highlights: [long] }))[0]?.words.length).toBe(HIGHLIGHT_WORDS * 2);
  });
});

describe('what H does with the words chosen', () => {
  const list = [at(10, 20), at(30, 40), at(50, 60, 'c2.xhtml')];

  it('takes off the highlight the words lie in', () => {
    expect(highlightChange(list, 'c1.xhtml', { from: 12, to: 18 })).toEqual({ off: at(10, 20) });
    expect(highlightChange(list, 'c1.xhtml', { from: 10, to: 20 })).toEqual({ off: at(10, 20) });
  });

  it('keeps new words as one highlight', () => {
    expect(highlightChange(list, 'c1.xhtml', { from: 22, to: 28 })).toEqual({
      span: { from: 22, to: 28 },
      remove: [],
    });
  });

  it('joins every highlight the words overlap or touch, in that chapter alone', () => {
    expect(highlightChange(list, 'c1.xhtml', { from: 15, to: 35 })).toEqual({
      span: { from: 10, to: 40 },
      remove: [at(10, 20), at(30, 40)],
    });
    expect(highlightChange(list, 'c1.xhtml', { from: 20, to: 30 })).toEqual({
      span: { from: 10, to: 40 },
      remove: [at(10, 20), at(30, 40)],
    });
    expect(highlightChange(list, 'c2.xhtml', { from: 5, to: 15 })).toEqual({
      span: { from: 5, to: 15 },
      remove: [],
    });
  });
});
