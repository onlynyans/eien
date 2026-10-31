// A book's title page and its imprint (#40, Phase 3d, Set as a book): two
// pages Eien sets before the book's first chapter, in pages alone. The
// title page from the book's own details, set as every other (the title high
// at display size, a hairline, the author in capitals, the folders it's
// shelved in at the foot); facing it, the imprint, Eien's record of this copy
// in the machine's voice: how long it is and how it's set, read off the page
// (core/epub/imprint.ts), where it came from and where your marks are kept.
// Both are Eien's own, never the book's words: a place never counts them,
// and nothing copies, quotes or bookmarks them (./chapter-place.ts OWN).

import { faceOf } from '../../core/config';
import { type Epub, lengthWords, type SetAs, setAsWords } from '../../core/epub';
import { baseName } from '../../core/paths';
import { h } from '../dom';

/** The front matter, first in the first chapter's words. */
export const FRONT = '.epub-front';

/** Its pages, each a page of its own (./epub-set.css): the title page and the imprint. */
export const FRONT_PAGES = 2;

/**
 * The front matter of `epub`, from `path` in the vault, shelved under
 * `crumbs`. Its lines are divs, never paragraphs: a book's paragraph rules
 * (indents, justified lines) are the book's alone.
 */
export function frontMatter(epub: Epub, path: string, crumbs: string): HTMLElement {
  const title = epub.title || baseName(path);
  const byline = epub.author ? `, by ${epub.author}.` : '.';
  return h(
    'section',
    { class: 'epub-front' },
    h(
      'section',
      { class: 'epub-front__page epub-front__title', attrs: { 'aria-label': 'Title page' } },
      h('div', { class: 'epub-front__book', text: title }),
      h('span', { class: 'epub-front__rule', attrs: { 'aria-hidden': 'true' } }),
      epub.author ? h('div', { class: 'epub-front__author', text: epub.author }) : null,
      h('div', { class: 'epub-front__shelf label', text: crumbs }),
    ),
    h(
      'section',
      { class: 'epub-front__page epub-front__imprint', attrs: { 'aria-label': 'Imprint' } },
      h('div', { class: 'label', text: 'This copy' }),
      h('div', {}, h('i', { text: title }), byline),
      h('div', { attrs: { 'data-imprint': 'length' } }),
      h(
        'div',
        {},
        'Set in ',
        h('span', { class: 'epub-front__face', attrs: { 'data-imprint': 'face' } }),
        ' ',
        h('span', { attrs: { 'data-imprint': 'set' } }),
        '.',
      ),
      h('div', { text: `From ${baseName(path)}.` }),
      h('div', { text: 'Your place and bookmarks are kept in .eien/reading/.' }),
    ),
  );
}

const px = (value: string) => Number.parseFloat(value) || 0;

/**
 * `chapter`'s front matter, if it has one, saying how long the book is
 * (`chapters`, and its `pages` once counted) and how it's set, read off the
 * page as it's laid out on its `leaf`: the face, its size on its line, a
 * page's measure, justified or ragged (./epub-set.css's --epub-align), and
 * whether the window hyphenates (./hyphens.ts).
 */
export function fillImprint(
  chapter: HTMLElement,
  leaf: HTMLElement,
  chapters: number,
  pages: number | null,
): void {
  const front = chapter.querySelector(FRONT);
  if (!front) return;
  const style = getComputedStyle(chapter);
  const size = px(style.fontSize);
  const set: SetAs = {
    size,
    leading: px(style.lineHeight),
    ems: size > 0 ? px(chapter.style.columnWidth) / size : 0,
    spread: chapter.style.columnCount === '2',
    justified: style.getPropertyValue('--epub-align').trim() === 'justify',
    hyphenated: leaf.hasAttribute('data-hyphens'),
  };
  const say = (part: string, words: string) => {
    const element = front.querySelector(`[data-imprint="${part}"]`);
    // Only what changed: the front is in the chapter's columns, and its text lays them out anew.
    if (element && element.textContent !== words) element.textContent = words;
  };
  const face = leaf.dataset.face ?? '';
  say('length', lengthWords(chapters, pages));
  say('face', faceOf(face)?.name ?? face);
  say('set', setAsWords(set));
}
