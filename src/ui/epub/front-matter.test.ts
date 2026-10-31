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
