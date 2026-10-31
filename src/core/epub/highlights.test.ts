import { describe, expect, it } from 'vitest';
import { bookmarksOf, withBookmarks } from './bookmarks';
import {
  HIGHLIGHT_WORDS,
  type Highlight,
  highlightChange,
  highlightsOf,
  MAX_HIGHLIGHTS,
  pressHighlight,
  withHighlights,
  withRestored,
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

// QA (#40, Phase 5a): the edges of what H decides, each a press a hand makes.
describe('what H does at the edges', () => {
  const list = [at(10, 20), at(30, 40)];

  it('keeps the words as they are in a book with no highlights, or none in their chapter', () => {
    expect(highlightChange([], 'c1.xhtml', { from: 3, to: 9 })).toEqual({
      span: { from: 3, to: 9 },
      remove: [],
    });
    expect(highlightChange(list, 'c2.xhtml', { from: 10, to: 20 })).toEqual({
      span: { from: 10, to: 20 },
      remove: [],
    });
  });

  it('takes off a highlight chosen exactly, word for word, never joining it to itself', () => {
    expect(highlightChange(list, 'c1.xhtml', { from: 30, to: 40 })).toEqual({ off: at(30, 40) });
  });

  it('joins a highlight the words touch at its start alone, or at its end alone', () => {
    expect(highlightChange(list, 'c1.xhtml', { from: 4, to: 10 })).toEqual({
      span: { from: 4, to: 20 },
      remove: [at(10, 20)],
    });
    expect(highlightChange(list, 'c1.xhtml', { from: 40, to: 45 })).toEqual({
      span: { from: 30, to: 45 },
      remove: [at(30, 40)],
    });
  });

  it('joins words that hold a highlight whole, and run past it either side, into one over them', () => {
    expect(highlightChange(list, 'c1.xhtml', { from: 5, to: 25 })).toEqual({
      span: { from: 5, to: 25 },
      remove: [at(10, 20)],
    });
    // Starting inside one and running out past its end is no longer inside it: joined, not taken off.
    expect(highlightChange(list, 'c1.xhtml', { from: 15, to: 25 })).toEqual({
      span: { from: 10, to: 25 },
      remove: [at(10, 20)],
    });
  });

  it('leaves a highlight a character away be', () => {
    expect(highlightChange(list, 'c1.xhtml', { from: 21, to: 29 })).toEqual({
      span: { from: 21, to: 29 },
      remove: [],
    });
  });

  it('takes off the first of two that overlap in a file from elsewhere, both holding the words', () => {
    const theirs = [at(0, 30), at(10, 40)];
    expect(highlightChange(theirs, 'c1.xhtml', { from: 12, to: 20 })).toEqual({ off: at(0, 30) });
  });
});

describe('H made in the file, and Put back', () => {
  const words = (span: { from: number; to: number }) => `words ${span.from}`;

  it('keeps the words chosen, joined with what they touch, in one change', () => {
    const before = withHighlights(null, { add: at(10, 20) });
    const pressed = pressHighlight(before, 'c1.xhtml', { from: 18, to: 30 }, words);
    expect(pressed).toMatchObject({ off: false, done: at(10, 30) });
    expect(highlightsOf(pressed.text)).toEqual([at(10, 30)]);
  });

  it('takes off the highlight the words lie in', () => {
    const before = withHighlights(null, { add: at(10, 20) });
    const pressed = pressHighlight(before, 'c1.xhtml', { from: 12, to: 14 }, words);
    expect(pressed).toMatchObject({ off: true, done: at(10, 20) });
    expect(highlightsOf(pressed.text)).toEqual([]);
  });

  it('writes nothing over a newer Eien’s file', () => {
    expect(
      pressHighlight(file({ version: 2 }), 'c1.xhtml', { from: 1, to: 2 }, words).text,
    ).toBeNull();
    expect(withRestored(file({ version: 2 }), at(1, 2))).toBeNull();
  });

  it('puts one back as it was, joined with one made meanwhile, and nothing where one holds it', () => {
    expect(highlightsOf(withRestored(null, at(10, 20)))).toEqual([at(10, 20)]);
    const meanwhile = withHighlights(null, { add: at(18, 30) });
    expect(highlightsOf(withRestored(meanwhile, at(10, 20)))).toEqual([{ ...at(10, 20), to: 30 }]);
    const holding = withHighlights(null, { add: at(0, 40) });
    expect(highlightsOf(withRestored(holding, at(10, 20)))).toEqual([at(0, 40)]);
  });
});
