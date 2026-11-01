// QA (#40, Phase 3d): a turn's copy of the words in sight, cut from the
// chapter by offsets: never Eien's front matter, whether the cut starts at
// the chapter's start (the opening's copy) or after a word; a paragraph
// begun on the page before keeps no indent or capitals; the paragraph cut at
// the page's foot marked to set its lines as the page does, and none other.

import { afterEach, describe, expect, it } from 'vitest';
import { CUT_END, sightCut } from './page-cut';

/** The first chapter, Eien's front matter first, then `body`. */
function chapterOf(body: string): HTMLElement {
  const chapter = document.createElement('div');
  chapter.innerHTML = `<section class="epub-front"><div>Title</div><div>This copy</div></section>${body}`;
  document.body.append(chapter);
  return chapter;
}

/** The cut's words, laid in a box to read. */
function cut(chapter: HTMLElement, from: number, to: number | null): HTMLElement {
  const box = document.createElement('div');
  box.append(sightCut(chapter, from, to));
  return box;
}

afterEach(() => document.body.replaceChildren());

describe('a sight’s words cut for a turn’s copy', () => {
  it('starts past the front matter at the opening, and holds none of it later on', () => {
    const chapter = chapterOf(
      '<h2 data-part="chapter-title">One</h2><p data-part="first-line">It is a truth.</p><p>Second.</p>',
    );
    const opening = cut(chapter, 0, 'OneIt is'.length);
    expect(opening.querySelector('.epub-front')).toBeNull();
    expect(opening.textContent).toBe('OneIt is');
    const later = cut(chapter, 'OneIt is'.length, null);
    expect(later.querySelector('.epub-front')).toBeNull();
    expect(later.textContent).toBe(' a truth.Second.');
  });

  it('sets a paragraph begun on the page before as its middle: no indent, no capitals', () => {
    const chapter = chapterOf(
      '<p data-part="first-line">It is a truth.</p><p data-part="epigraph">An epigraph, long.</p>',
    );
    const middle = cut(chapter, 'It is'.length, null);
    const [first, second] = middle.querySelectorAll('p');
    expect(first?.style.textIndent).toBe('0px');
    expect(first?.hasAttribute('data-part')).toBe(false);
    expect(second?.dataset.part).toBe('epigraph');
    // An epigraph begun before keeps its own look, only its indent gone.
    const inside = cut(chapter, 'It is a truth.An'.length, null).querySelector('p');
    expect(inside?.dataset.part).toBe('epigraph');
    expect(inside?.style.textIndent).toBe('0px');
  });

  it('marks the paragraph the page ends inside of, and none that ends on it', () => {
    const chapter = chapterOf('<p>One two.</p><blockquote><p>Three four.</p></blockquote>');
    const inside = cut(chapter, 0, 'One two.Three'.length);
    expect([...inside.querySelectorAll(`[${CUT_END}]`)].map((block) => block.textContent)).toEqual([
      'Three',
    ]);
    const between = cut(chapter, 0, 'One two.'.length);
    expect(between.querySelector(`[${CUT_END}]`)).toBeNull();
    // The chapter's last page ends with the chapter: nothing cut.
    expect(cut(chapter, 0, null).querySelector(`[${CUT_END}]`)).toBeNull();
  });

  it('marks the block holding the cut’s last words, not the last one opened before them', () => {
    const chapter = chapterOf('<blockquote><p>One.</p>Two three.</blockquote>');
    const marked = cut(chapter, 0, 'One.Two'.length).querySelector(`[${CUT_END}]`);
    expect(marked?.localName).toBe('blockquote');
  });

  it('hides each block the page before ended: its gap was that page’s, dropped at the break (#60)', () => {
    const chapter = chapterOf(
      '<p data-part="first-line">It is a truth.</p><blockquote><p>Quoted.</p></blockquote><p>Next.</p>',
    );
    const after = cut(chapter, 'It is a truth.'.length, null);
    // Still there, so the paragraph after it is set as one after another (indented).
    const ended = after.querySelector<HTMLElement>('[data-part="first-line"]');
    expect(ended?.textContent).toBe('');
    expect(ended?.style.display).toBe('none');
    expect(after.querySelector('blockquote')?.style.display).toBe('');
    const past = cut(chapter, 'It is a truth.Quoted.'.length, null);
    expect(
      [...past.querySelectorAll<HTMLElement>('blockquote, p')].map((block) => block.style.display),
    ).toEqual(['none', 'none', '']);
  });

  it('drops the gap above what stands at the page’s head, as a break does in sight', () => {
    const chapter = chapterOf('<p>One.</p><blockquote><p>Quoted.</p></blockquote><p>Two.</p>');
    const page = cut(chapter, 'One.'.length, null);
    expect(page.querySelector('blockquote')?.style.marginTop).toBe('0px');
    expect(page.querySelector<HTMLElement>('blockquote p')?.style.marginTop).toBe('0px');
    expect([...page.querySelectorAll<HTMLElement>('p')].at(-1)?.style.marginTop).toBe('');
    // The chapter's own first page follows no break: its gaps stand.
    const opening = cut(chapterOf('<blockquote><p>Epigraph.</p></blockquote>'), 0, null);
    expect(opening.querySelector('blockquote')?.style.marginTop).toBe('');
  });

  it('still brings a picture that begins the page, with no gap above it', () => {
    const chapter = chapterOf('<p>One.</p><div data-part="plate"><img alt=""></div><p>Two.</p>');
    const plate = cut(chapter, 'One.'.length, null).querySelector<HTMLElement>(
      '[data-part="plate"]',
    );
    expect(plate?.querySelector('img')).not.toBeNull();
    expect(plate?.style.marginTop).toBe('0px');
  });
});
