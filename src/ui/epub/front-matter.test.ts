import { afterEach, describe, expect, it } from 'vitest';
import type { Epub } from '../../core/epub';
import { wordsIn } from './book-words';
import { characterAt, offsetAfter, piecesOf, wordsFrom } from './chapter-place';
import { fillImprint, frontMatter } from './front-matter';

const EPUB = { title: 'Pride and Prejudice', author: 'Jane Austen' } as unknown as Epub;

/** The first chapter, drawn after its front matter, on a leaf worn as a book's page in pages. */
function first() {
  const leaf = document.createElement('div');
  leaf.dataset.face = 'literata';
  const chapter = document.createElement('div');
  chapter.innerHTML = '<p>It is a truth.</p>';
  chapter.prepend(frontMatter(EPUB, 'Novels/Austen/Pride.epub', 'Novels / Austen'));
  leaf.append(chapter);
  document.body.append(leaf);
  return { leaf, chapter };
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('a book’s title page and imprint (Phase 3d)', () => {
  it('sets the book’s own details: its title, author and shelf; where it came from', () => {
    const { chapter } = first();
    const title = chapter.querySelector('[aria-label="Title page"]');
    expect(title?.textContent).toContain('Pride and Prejudice');
    expect(title?.textContent).toContain('Jane Austen');
    expect(title?.querySelector('.epub-front__shelf')?.textContent).toBe('Novels / Austen');
    const imprint = chapter.querySelector('[aria-label="Imprint"]');
    expect(imprint?.textContent).toContain('Pride and Prejudice, by Jane Austen.');
    expect(imprint?.textContent).toContain('From Pride.epub.');
    // Divs, never paragraphs: a book's paragraph rules are the book's alone.
    expect(chapter.querySelector('.epub-front p')).toBeNull();
  });

  it('names a book with no title by its file, and one with no author leaves the byline off', () => {
    const front = frontMatter({ title: '', author: '' } as unknown as Epub, 'A/b.epub', '');
    expect(front.querySelector('.epub-front__book')?.textContent).toBe('b.epub');
    expect(front.querySelector('.epub-front__author')).toBeNull();
    expect(front.textContent).toContain('b.epub.');
  });

  it('is none of the book’s words: never counted, placed, copied or bookmarked', () => {
    const { chapter } = first();
    expect(piecesOf(chapter).map((text) => text.data)).toEqual(['It is a truth.']);
    expect(characterAt(chapter, 0)?.toString()).toBe('I');
    expect(offsetAfter(chapter, chapter.querySelector('p') as Node)).toBe(0);
    expect(wordsFrom(chapter, 0, 200)).toBe('It is a truth.');
    const all = document.createRange();
    all.selectNodeContents(chapter);
    expect(wordsIn(all).textContent).toBe('It is a truth.');
  });

  it('says how long the book is and how it’s set, read off the page', () => {
    const { leaf, chapter } = first();
    chapter.style.fontSize = '22px';
    chapter.style.lineHeight = '35px';
    chapter.style.columnWidth = '660px';
    chapter.style.columnCount = '2';
    chapter.style.setProperty('--epub-align', 'justify');
    leaf.setAttribute('data-hyphens', '');
    fillImprint(chapter, leaf, 61, null);
    const said = (part: string) => chapter.querySelector(`[data-imprint="${part}"]`)?.textContent;
    expect(said('length')).toBe('61 chapters.');
    expect(said('face')).toBe('Literata');
    expect(said('set')).toBe('at 22 on 35 px, lines of 30 em a page, justified and hyphenated');
    // Counted, and where the window can't hyphenate: ragged, and said so.
    chapter.style.setProperty('--epub-align', 'start');
    leaf.removeAttribute('data-hyphens');
    fillImprint(chapter, leaf, 61, 2450);
    expect(said('length')).toBe('61 chapters, 2,450 pages.');
    expect(said('set')).toContain('ragged right');
    expect(said('set')).not.toContain('hyphenated');
  });
});

// QA (#40, Phase 3d): the imprint is in the chapter's columns, so filling it
// with the same words again must change nothing (its text would lay the
// columns out anew); words chosen from the title page into the text copy the
// text alone; and a chapter with no front matter is left as it is.
describe('the imprint filled again, and words chosen across the front matter', () => {
  /** The leaf and chapter set as `first()` makes them, laid as a spread. */
  function set() {
    const book = first();
    book.chapter.style.fontSize = '22px';
    book.chapter.style.lineHeight = '35px';
    book.chapter.style.columnWidth = '660px';
    return book;
  }

  it('changes nothing when what it says is the same', () => {
    const { leaf, chapter } = set();
    fillImprint(chapter, leaf, 61, 2450);
    const watched = new MutationObserver(() => {});
    watched.observe(chapter, { subtree: true, childList: true, characterData: true });
    fillImprint(chapter, leaf, 61, 2450);
    expect(watched.takeRecords()).toEqual([]);
    // Counted further, it says the new length alone.
    fillImprint(chapter, leaf, 61, 2451);
    const changed = watched.takeRecords().map((record) => record.target);
    watched.disconnect();
    const length = chapter.querySelector('[data-imprint="length"]');
    expect(changed.length).toBeGreaterThan(0);
    expect(changed.every((node) => node === length || node.parentNode === length)).toBe(true);
    expect(length?.textContent).toBe('61 chapters, 2,451 pages.');
  });

  it('leaves a chapter with no front matter as it is', () => {
    const chapter = document.createElement('div');
    chapter.innerHTML = '<p>Chapter II’s words.</p>';
    fillImprint(chapter, document.createElement('div'), 61, 2450);
    expect(chapter.innerHTML).toBe('<p>Chapter II’s words.</p>');
  });

  it('copies none of it in words chosen from the imprint into the chapter', () => {
    const { chapter } = first();
    const imprint = chapter.querySelector('[aria-label="Imprint"] div') as HTMLElement;
    const words = chapter.querySelector('p')?.firstChild as Text;
    const chosen = document.createRange();
    chosen.setStart(imprint.firstChild as Text, 2);
    chosen.setEnd(words, 'It is a'.length);
    expect(wordsIn(chosen).textContent).toBe('It is a');
  });
});
