// Ink over a book's words (#40, Phase 5a): spans painted as ranges of the
// drawn text, one Highlight per name shared by every page, each page's own
// taken away alone; nothing painted without the API; and a turn's copy inked
// in elements of its own.

import { afterEach, describe, expect, it } from 'vitest';
import { offsetAt, spanOf, walked } from './chapter-range';
import { INKED, Ink, inkCopy } from './ink';
import { inkCount, inked, withInk } from './test-ink';

/** A drawn chapter: a heading, a paragraph in pieces, a scene break, and another paragraph. */
function chapter(): HTMLElement {
  const words = document.createElement('div');
  words.innerHTML =
    '<h2>Chapter I.</h2>\n<p>It is a <em>truth</em> universally acknowledged.</p>' +
    '<p class="scene-break">* * *</p><p>However little known.</p>';
  document.body.append(words);
  return words;
}

afterEach(() => document.body.replaceChildren());

describe('ink over a chapter', () => {
  withInk();

  it('paints each span as the words it holds, across pieces, never past a block’s end', () => {
    const words = chapter();
    const ink = new Ink('epub-highlight');
    // "Chapter I." is 0–10; "It is a " 10–18, "truth" 18–23, " universally acknowledged." 23–49;
    // the break's marks aren't the book's; "However little known." 49–70.
    ink.paint(walked(words), [
      { from: 16, to: 31 },
      { from: 36, to: 49 },
    ]);
    expect(inked('epub-highlight')).toEqual(['a truth univers', 'acknowledged.']);
  });

  it('clamps a span to the chapter’s words, and paints none past them all', () => {
    const words = chapter();
    const ink = new Ink('epub-highlight');
    ink.paint(walked(words), [
      { from: 57, to: 9000 },
      { from: 9000, to: 9010 },
    ]);
    expect(inked('epub-highlight')).toEqual(['little known.']);
  });

  it('shares one Highlight among pages, each taking its own away alone', () => {
    const words = chapter();
    const one = new Ink('epub-highlight');
    const two = new Ink('epub-highlight');
    one.paint(walked(words), [{ from: 0, to: 7 }]);
    two.paint(walked(words), [{ from: 10, to: 12 }]);
    expect(inked('epub-highlight')).toEqual(['Chapter', 'It']);
    one.paint(walked(words), [{ from: 0, to: 4 }]);
    expect(inked('epub-highlight')).toEqual(['It', 'Chap']);
    one.clear();
    expect(inked('epub-highlight')).toEqual(['It']);
    two.clear();
    expect(inkCount('epub-highlight')).toBe(0);
  });

  it('maps words chosen to offsets, a boundary in Eien’s own words taking the next of the book’s', () => {
    const words = chapter();
    const range = document.createRange();
    const em = words.querySelector('em')?.firstChild as Text;
    range.setStart(em, 1);
    range.setEnd(words.querySelector('.scene-break')?.firstChild as Text, 2);
    // To the break's words, which aren't the book's: the span ends where the next paragraph begins.
    expect(spanOf(words, range)).toEqual({ from: 19, to: 49 });
    expect(offsetAt(words, words, 0)).toBe(0);
  });
});

describe('ink without the API', () => {
  it('paints nothing and makes no range, an older WebView’s or the tests’ window', () => {
    const words = chapter();
    const ink = new Ink('epub-highlight');
    expect(() => ink.paint(walked(words), [{ from: 0, to: 5 }])).not.toThrow();
    expect(() => ink.clear()).not.toThrow();
  });
});

describe('a turn’s copy, inked', () => {
  it('wraps each span’s words where they fall, its offsets the chapter’s less the page’s first word', () => {
    const copy = document.createElement('div');
    // The page in sight began at "a truth universally acknowledged.", 16 into the chapter above.
    copy.innerHTML =
      '<p>a <em>truth</em> universally acknowledged.</p><p>However little known.</p>';
    inkCopy(walked(copy), 16, 'epub-highlight', [
      { from: 18, to: 23 },
      { from: 23, to: 31 },
      { from: 49, to: 56 },
      { from: 0, to: 5 },
    ]);
    const ink = [...copy.querySelectorAll(`[${INKED}="epub-highlight"]`)].map(
      (each) => each.textContent,
    );
    expect(ink).toEqual(['truth', ' univers', 'However']);
    // The words themselves are as they were.
    expect(copy.textContent).toBe('a truth universally acknowledged.However little known.');
  });

  it('joins spans that overlap, so none is wrapped inside another', () => {
    const copy = document.createElement('div');
    copy.innerHTML = '<p>abcdefghij</p>';
    inkCopy(walked(copy), 0, 'epub-highlight', [
      { from: 2, to: 6 },
      { from: 4, to: 8 },
    ]);
    expect([...copy.querySelectorAll(`[${INKED}]`)].map((each) => each.textContent)).toEqual([
      'cdefgh',
    ]);
  });
});

// QA (#40, Phase 5a): a copy's ink at its edges, each wrap holding its own words and no more.
describe('a turn’s copy, inked at its edges', () => {
  const inks = (copy: HTMLElement) =>
    [...copy.querySelectorAll(`[${INKED}]`)].map((each) => each.textContent);

  it('wraps a span across pieces of several elements, each piece’s part in its own wrap', () => {
    const copy = document.createElement('div');
    copy.innerHTML = '<p>ab<em>cd</em><strong>ef</strong></p><p>gh</p>';
    inkCopy(walked(copy), 0, 'epub-highlight', [{ from: 1, to: 7 }]);
    expect(inks(copy)).toEqual(['b', 'cd', 'ef', 'g']);
    // Each wrap where its piece was: the em's words in the em, the strong's in the strong.
    expect(copy.querySelector('em')?.innerHTML).toBe(`<span ${INKED}="epub-highlight">cd</span>`);
    expect(copy.querySelector('strong')?.textContent).toBe('ef');
    expect(copy.textContent).toBe('abcdefgh');
  });

  it('wraps a span from a piece’s first character to a piece’s last, leaving no empty wrap', () => {
    const copy = document.createElement('div');
    copy.innerHTML = '<p>ab</p><p>cd</p><p>ef</p>';
    inkCopy(walked(copy), 0, 'epub-highlight', [{ from: 2, to: 4 }]);
    expect(inks(copy)).toEqual(['cd']);
    expect(copy.querySelectorAll('p')[1]?.textContent).toBe('cd');
    expect(copy.textContent).toBe('abcdef');
  });

  it('inks a span begun before the page from the page’s first word, and one ended before it not at all', () => {
    const copy = document.createElement('div');
    copy.innerHTML = '<p>ab</p><p>cd</p>';
    // The page began 10 into the chapter: a span from 6 to 13 holds its first three characters.
    inkCopy(walked(copy), 10, 'epub-highlight', [{ from: 6, to: 13 }]);
    expect(inks(copy)).toEqual(['ab', 'c']);
    const before = document.createElement('div');
    before.innerHTML = '<p>ab</p><p>cd</p>';
    inkCopy(walked(before), 10, 'epub-highlight', [{ from: 0, to: 10 }]);
    expect(inks(before)).toEqual([]);
  });

  it('passes over Eien’s own words in it: a break’s marks are never inked', () => {
    const copy = document.createElement('div');
    copy.innerHTML = '<p>ab</p><p class="scene-break">* * *</p><p>cd</p>';
    inkCopy(walked(copy), 0, 'epub-highlight', [{ from: 0, to: 4 }]);
    expect(inks(copy)).toEqual(['ab', 'cd']);
  });
});
