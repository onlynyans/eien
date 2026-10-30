import { describe, expect, it } from 'vitest';
import { type CleanNode, cleanHtml } from '../html';
import { countChapter } from './chapter-count';
import { epubRules } from './epub-rules';

const text = (words: string): CleanNode => ({ kind: 'text', text: words });
const element = (name: string, children: CleanNode[] = [], attrs = {}): CleanNode => ({
  kind: 'element',
  name,
  attrs,
  children,
});
const marker = (name: string) => element('a', [], { anchor: name });

describe('a chapter counted as a place counts it', () => {
  it('counts every word but a blank one and a rule’s', () => {
    const nodes = [
      element('h2', [text('Chapter I.')]),
      text('\n  '),
      element('p', [text('It is a truth'), element('em', [text(' universally')])]),
      element('hr', [text('* * *')]),
      element('p', [text('Mr. Bennet.')]),
    ];
    expect(countChapter(nodes).length).toBe(
      'Chapter I.'.length + 'It is a truth'.length + ' universally'.length + 'Mr. Bennet.'.length,
    );
  });

  it('finds where each place asked for begins: the words before its marker, the first of a name', () => {
    const nodes = [
      element('p', [text('abcde'), marker('page-2')]),
      element('p', [element('span', [marker('page-3'), text('fgh')]), marker('page-2')]),
      marker('other'),
    ];
    const { anchors } = countChapter(nodes, new Set(['page-2', 'page-3', 'lost']));
    expect(Object.fromEntries(anchors)).toEqual({ 'page-2': 5, 'page-3': 5 });
  });

  it('counts a picture’s words the cleaner kept as words, for a picture it won’t show', () => {
    // Its file not in the zip: the cleaner keeps its alt as plain words, in brackets.
    const nodes = cleanHtml(
      '<p><img src="gone.jpg" alt="He rode a black horse."/></p>',
      epubRules(
        'a.xhtml',
        () => false,
        () => false,
      ),
    );
    expect(countChapter(nodes).length).toBe('[He rode a black horse.]'.length);
  });

  // QA (#40, Phase 4a): a page-list's markers where books put them, at a chapter's edges.
  it('finds a place at the chapter’s very end, and in a chapter of no words, at 0', () => {
    const ending = countChapter(
      [element('p', [text('abc')]), marker('page-9')],
      new Set(['page-9']),
    );
    expect(ending.anchors.get('page-9')).toBe(ending.length);
    const empty = countChapter([element('div', [marker('page-1')])], new Set(['page-1']));
    expect(empty).toEqual({ length: 0, anchors: new Map([['page-1', 0]]) });
  });

  it('counts a space-only piece, a no-break space’s too, as nothing, as the window does', () => {
    const noBreak = String.fromCharCode(0xa0);
    expect(
      countChapter([element('p', [text(`${noBreak} \t`)]), element('p', [text('ab')])]).length,
    ).toBe(2);
  });

  it('counts nothing in a chapter with no words', () => {
    expect(countChapter([element('figure', [element('img', [], { src: 'a.jpg' })])])).toEqual({
      length: 0,
      anchors: new Map(),
    });
  });
});
