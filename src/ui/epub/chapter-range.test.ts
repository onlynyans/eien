// A run of a drawn chapter's words (#40, Phase 5a), at its edges: a
// boundary on an element, at a piece's end, past the last piece, in a blank
// piece or Eien's own words, each the next of the book's characters; and a
// span's bounds ending in its own piece, clamped to the chapter's words, or
// none for no words.

import { afterEach, describe, expect, it } from 'vitest';
import { boundsOf, offsetAt, rangeOver, spanOf, walked } from './chapter-range';

/**
 * "Ab" 0–2, "cd" 2–4 (in an em), "ef" 4–6; a blank piece between blocks; a
 * break's marks, Eien's; "gh" 6–8.
 */
function chapter(): HTMLElement {
  const words = document.createElement('div');
  words.innerHTML = '<p>Ab<em>cd</em>ef</p>\n<p class="scene-break">* * *</p><p>gh</p>';
  document.body.append(words);
  return words;
}

const textOf = (bounds: ReturnType<typeof boundsOf>) =>
  bounds ? rangeOver(bounds).toString() : null;

afterEach(() => document.body.replaceChildren());

describe('a boundary among a chapter’s words', () => {
  it('on an element is the offset of the next of its words', () => {
    const words = chapter();
    const p = words.querySelector('p') as HTMLElement;
    // Before the em (the paragraph's second child): its first word, "cd".
    expect(offsetAt(words, p, 1)).toBe(2);
    // Past every child of the paragraph: the next paragraph's "gh", the break's marks skipped.
    expect(offsetAt(words, p, p.childNodes.length)).toBe(6);
    expect(offsetAt(words, words, 0)).toBe(0);
  });

  it('at a piece’s end is that piece’s end, at its start that piece’s start', () => {
    const words = chapter();
    const ab = words.querySelector('p')?.firstChild as Text;
    expect(offsetAt(words, ab, ab.length)).toBe(2);
    expect(offsetAt(words, ab, 0)).toBe(0);
  });

  it('after the last piece is the chapter’s length', () => {
    const words = chapter();
    expect(offsetAt(words, words, words.childNodes.length)).toBe(8);
    const gh = words.lastElementChild?.firstChild as Text;
    expect(offsetAt(words, gh, gh.length)).toBe(8);
  });

  it('in a blank piece, or in a break’s marks, is the next of the book’s characters', () => {
    const words = chapter();
    const blank = words.childNodes[1] as Text;
    expect(blank.data.trim()).toBe('');
    expect(offsetAt(words, blank, 0)).toBe(6);
    const marks = words.querySelector('.scene-break')?.firstChild as Text;
    expect(offsetAt(words, marks, 3)).toBe(6);
  });

  it('chooses no words where both ends are the same of the book’s characters', () => {
    const words = chapter();
    const range = document.createRange();
    range.setStart(words.childNodes[1] as Text, 0);
    range.setEnd(words.querySelector('.scene-break')?.firstChild as Text, 2);
    expect(spanOf(words, range)).toBeNull();
  });
});

describe('where a span’s words are drawn', () => {
  it('ends in its last character’s piece, never at the next piece’s start', () => {
    const walk = walked(chapter());
    const bounds = boundsOf(walk, { from: 0, to: 2 });
    expect(bounds?.endContainer.data).toBe('Ab');
    expect(bounds?.endOffset).toBe(2);
    // A whole paragraph's words: to its last piece's end, not into "gh".
    const paragraph = boundsOf(walk, { from: 0, to: 6 });
    expect(paragraph?.endContainer.data).toBe('ef');
    expect(textOf(paragraph)).toBe('Abcdef');
  });

  it('starts in the piece a span’s first character is in, at a piece’s first character', () => {
    const walk = walked(chapter());
    const bounds = boundsOf(walk, { from: 2, to: 3 });
    expect(bounds?.startContainer.data).toBe('cd');
    expect(bounds?.startOffset).toBe(0);
    expect(textOf(boundsOf(walk, { from: 4, to: 8 }))).toBe('ef\n* * *gh');
  });

  it('holds a span to the chapter’s words: from before its first, to past its last', () => {
    const walk = walked(chapter());
    expect(textOf(boundsOf(walk, { from: -5, to: 3 }))).toBe('Abc');
    expect(textOf(boundsOf(walk, { from: 7, to: 900 }))).toBe('h');
  });

  it('is none for no words: an empty span, one backwards, one past the chapter, a chapter of none', () => {
    const walk = walked(chapter());
    expect(boundsOf(walk, { from: 3, to: 3 })).toBeNull();
    expect(boundsOf(walk, { from: 5, to: 2 })).toBeNull();
    expect(boundsOf(walk, { from: 8, to: 12 })).toBeNull();
    const none = document.createElement('div');
    none.innerHTML = '<p> </p><p class="scene-break">* * *</p>';
    expect(boundsOf(walked(none), { from: 0, to: 4 })).toBeNull();
  });

  it('chosen again, are the same span', () => {
    const words = chapter();
    const walk = walked(words);
    for (const span of [
      { from: 0, to: 8 },
      { from: 1, to: 5 },
      { from: 2, to: 4 },
      { from: 6, to: 7 },
    ]) {
      const bounds = boundsOf(walk, span);
      if (!bounds) throw new Error('no bounds');
      expect(spanOf(words, rangeOver(bounds))).toEqual(span);
    }
  });
});
