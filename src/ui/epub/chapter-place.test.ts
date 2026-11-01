// A place in a drawn chapter (#40, Phase 2), on the tests' own layout
// (./test-lines.ts).

import { afterEach, describe, expect, it } from 'vitest';
import { firstInSight, piecesOf, showOffset, wordsFrom } from './chapter-place';
import { linesOf } from './test-lines';

/** A chapter of paragraphs, with Eien's own scene break and a picture's words between. */
function chapterOf(...paragraphs: string[]): HTMLElement {
  const chapter = document.createElement('div');
  chapter.innerHTML = `<p>${paragraphs[0]}</p>\n  <div class="scene-break">***</div>\n${paragraphs
    .slice(1)
    .map((words) => `<p>${words}<span class="image-words">[Plate]</span></p>`)
    .join('\n')}`;
  document.body.append(chapter);
  return chapter;
}

afterEach(() => document.body.replaceChildren());

describe('a place in a drawn chapter', () => {
  it('counts the book’s words alone: not the space between blocks, nor Eien’s own', () => {
    const chapter = chapterOf('One two.', 'Three.');
    expect(piecesOf(chapter).map((piece) => piece.data)).toEqual(['One two.', 'Three.']);
  });

  it('is the first line in sight, by its first word', () => {
    const chapter = chapterOf('a'.repeat(25), 'b'.repeat(30));
    const scroller = { scrollTop: 0 };
    const rectOf = linesOf(chapter, scroller);
    expect(firstInSight(chapter, 0, rectOf)).toBe(0);
    scroller.scrollTop = 20; // the second line at the top
    expect(firstInSight(chapter, 0, rectOf)).toBe(10);
    scroller.scrollTop = 50; // halfway down the third: it's still in sight
    expect(firstInSight(chapter, 0, rectOf)).toBe(20);
    scroller.scrollTop = 60;
    expect(firstInSight(chapter, 0, rectOf)).toBe(30);
    scroller.scrollTop = 10_000; // past the words: read to the end
    expect(firstInSight(chapter, 0, rectOf)).toBe(55);
    expect(firstInSight(chapterOf(''), 0, rectOf)).toBe(0);
  });

  it('is shown again with its line at the scroller’s top, and measures the same there', () => {
    const chapter = chapterOf('a'.repeat(25), 'b'.repeat(30));
    const scroller = document.createElement('div');
    document.body.append(scroller);
    const rectOf = linesOf(chapter, scroller);
    showOffset(chapter, scroller, 34, rectOf);
    expect(scroller.scrollTop).toBe(60);
    expect(firstInSight(chapter, 0, rectOf)).toBe(30);
    showOffset(chapter, scroller, 0, rectOf);
    expect(scroller.scrollTop).toBe(0);
  });
});

// QA (#40, Phase 4b): a bookmark's words, as the list will show them.
describe('the words from a place', () => {
  it('read on from the place as a reader does: a space between two blocks, none inside one', () => {
    const chapter = document.createElement('div');
    chapter.innerHTML =
      '<h2>Chapter I</h2><p>It is a <em>truth</em> universally</p><p>acknowledged.</p>';
    expect(wordsFrom(chapter, 0, 200)).toBe('Chapter I It is a truth universally acknowledged.');
    // From inside a word (a page that begins inside a hyphenated one, Phase 3d): the whole word, then on.
    expect(wordsFrom(chapter, 'Chapter IIt is a tr'.length, 200)).toBe(
      'truth universally acknowledged.',
    );
  });

  it('pass over Eien’s own marks (a scene break), and stop at the length asked', () => {
    const chapter = chapterOf('One two.', 'Three four.');
    expect(wordsFrom(chapter, 4, 200)).toBe('two. Three four.');
    expect(wordsFrom(chapter, 0, 6)).toBe('One tw');
  });

  it('are none past the chapter’s end, or in a chapter of no words', () => {
    expect(wordsFrom(chapterOf('One.'), 400, 200)).toBe('');
    const picture = document.createElement('div');
    // A picture and Eien's own scene break: nothing of the book's to read.
    picture.innerHTML = '<img alt=""><div class="scene-break">***</div>';
    expect(wordsFrom(picture, 0, 200)).toBe('');
  });
});

// QA (#40, Phase 3d): a page that begins inside a word hyphenated at the page
// before's foot names it whole; one that begins after a space, a hard
// hyphen or a figure's comma begins where it does; and a word its markup
// splits (an italic's start) is read from that piece alone.
describe('the words from a place inside a word', () => {
  it('back up to the word’s start over its letters and figures alone', () => {
    const chapter = document.createElement('div');
    chapter.innerHTML = '<p>A well-known 1,200 incomprehensibilities, rr2b.</p>';
    const from = (words: string) =>
      wordsFrom(chapter, (chapter.textContent ?? '').indexOf(words), 14);
    expect(from('hensibilities')).toBe('incomprehensib');
    expect(from('known')).toBe('known 1,200 in');
    expect(from('200')).toBe('200 incomprehe');
    expect(from('2b.')).toBe('rr2b.');
    expect(from('well')).toBe('well-known 1,2');
  });

  it('never back into the piece of the word before it', () => {
    const chapter = document.createElement('div');
    chapter.innerHTML = '<p>incompre<em>hensible</em> words</p>';
    expect(wordsFrom(chapter, 'incompre'.length, 200)).toBe('hensible words');
    expect(wordsFrom(chapter, 'incomprehen'.length, 200)).toBe('hensible words');
  });
});
