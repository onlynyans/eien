import { describe, expect, it } from 'vitest';
import type { CleanElement, CleanNode } from '../html';
import { BLOCK_NAMES, walkChapter } from './chapter-words';

const text = (words: string): CleanNode => ({ kind: 'text', text: words });
const element = (name: string, children: CleanNode[] = [], attrs = {}): CleanElement => ({
  kind: 'element',
  name,
  attrs,
  children,
});

/** Everything the walk tells, in order, each text with its block's first words. */
function walked(nodes: readonly CleanNode[]): string[] {
  const told: string[] = [];
  const name = (block: CleanElement | null) => (block ? block.name : '-');
  walkChapter(nodes, {
    text: (words, counted, block) =>
      told.push(`${counted ? 'text' : 'blank'} ${JSON.stringify(words)} in ${name(block)}`),
    lineBreak: (block) => told.push(`br in ${name(block)}`),
    anchor: (anchor) => told.push(`anchor ${anchor}`),
  });
  return told;
}

describe('one walk of a chapter’s words', () => {
  it('tells each text in reading order, blank ones apart, in its innermost block', () => {
    const nodes = [
      element('section', [
        element('h2', [text('Chapter I')]),
        text('\n  '),
        element('p', [element('em', [text('It')]), text(' '), element('b', [text('is')])]),
      ]),
    ];
    expect(walked(nodes)).toEqual([
      'text "Chapter I" in h2',
      'blank "\\n  " in section',
      'text "It" in p',
      'blank " " in p',
      'text "is" in p',
    ]);
  });

  it('passes over a rule and all under it, as the window draws Eien’s own break there', () => {
    expect(walked([element('hr', [text('* * *')]), element('p', [text('After')])])).toEqual([
      'text "After" in p',
    ]);
  });

  it('tells a line break and a link’s marker where they stand', () => {
    const nodes = [
      element('p', [text('one'), element('br'), element('a', [], { anchor: 'p2' }), text('two')]),
    ];
    expect(walked(nodes)).toEqual(['text "one" in p', 'br in p', 'anchor p2', 'text "two" in p']);
  });

  it('knows a text outside any block, and a picture’s words the cleaner kept as words', () => {
    expect(walked([text('[A plate]')])).toEqual(['text "[A plate]" in -']);
  });

  it('names its blocks once, every one an element a chapter may hold', () => {
    expect(new Set(BLOCK_NAMES).size).toBe(BLOCK_NAMES.length);
    expect(BLOCK_NAMES).toContain('p');
    expect(BLOCK_NAMES).not.toContain('span');
  });
});
