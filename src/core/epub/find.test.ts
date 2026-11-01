import { describe, expect, it } from 'vitest';
import { type CleanElement, type CleanNode, cleanHtml } from '../html';
import { chapterBlocks, offsetIn } from './book-text';
import { countChapter } from './chapter-count';
import { epubRules } from './epub-rules';
import { AS_WRITTEN, CONTEXT, type FindOptions, findIn, matcherOf } from './find';

const text = (words: string): CleanNode => ({ kind: 'text', text: words });
const element = (name: string, children: CleanNode[] = []): CleanElement => ({
  kind: 'element',
  name,
  attrs: {},
  children,
});

/** Every match of `query` in `nodes`, as spine item 0, by `options`. */
function find(nodes: readonly CleanNode[], query: string, options: FindOptions = AS_WRITTEN) {
  const matcher = matcherOf(query, options);
  if (matcher === null || matcher === 'invalid') throw new Error(`${query}: ${matcher}`);
  return findIn(chapterBlocks(nodes), matcher, 0);
}

describe('a chapter’s blocks, as Find reads them', () => {
  it('holds each block’s words as they read, blank pieces too, where it begins in the counted words', () => {
    const nodes = [
      element('h2', [text('Chapter I')]),
      text('\n  '),
      element('p', [element('em', [text('Mr.')]), text(' '), element('b', [text('Darcy')])]),
    ];
    const blocks = chapterBlocks(nodes);
    expect(blocks.map((block) => [block.text, block.from])).toEqual([
      ['Chapter I', 0],
      ['Mr. Darcy', 9],
    ]);
    // The space between the two words is read, never counted: "Darcy" begins at 9 + 3.
    expect(offsetIn(blocks[1] as never, 4)).toBe(12);
    expect(offsetIn(blocks[1] as never, 3)).toBe(12);
  });

  it('ends where the chapter’s count ends, a rule’s words left out, a line break ending a run', () => {
    const nodes = [
      element('p', [text('one'), element('br'), text('two')]),
      element('hr', [text('* * *')]),
      element('p', [text('three')]),
    ];
    const blocks = chapterBlocks(nodes);
    expect(blocks.map((block) => [block.text, block.from])).toEqual([
      ['one', 0],
      ['two', 3],
      ['three', 6],
    ]);
    const last = blocks.at(-1) as never;
    expect(offsetIn(last, 'three'.length)).toBe(countChapter(nodes).length);
  });
});

describe('Find in a chapter', () => {
  const chapter = cleanHtml(
    '<p>It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.</p>' +
      '<p>“My dear Mr. Bennet,” said his lady to him one day, “have you heard that Netherfield Park is let at last?”</p>' +
      '<p>Mr. Bennet replied that he had not.</p>',
    epubRules(
      'OEBPS/c1.xhtml',
      () => true,
      () => false,
    ),
  );

  it('finds the words in any case, each match its offsets in the chapter’s words', () => {
    const found = find(chapter, 'mr. bennet');
    expect(found.map((match) => match.words)).toEqual(['Mr. Bennet', 'Mr. Bennet']);
    const words = chapter.flatMap(function flat(node): string[] {
      return node.kind === 'text' ? [node.text] : node.children.flatMap(flat);
    });
    const all = words.join('');
    for (const match of found) expect(all.slice(match.from, match.to)).toBe(match.words);
  });

  it('takes curly and straight quotes alike, and any white space for a space', () => {
    expect(find(chapter, '"My dear').map((match) => match.words)).toEqual(['“My dear']);
    expect(find(chapter, 'good    fortune').length).toBe(1);
  });

  it('matches case, whole words and patterns as the find bar asks', () => {
    expect(find(chapter, 'mr.', { ...AS_WRITTEN, caseSensitive: true })).toEqual([]);
    expect(find(chapter, 'man', AS_WRITTEN).length).toBe(1);
    expect(find(chapter, 'a', { ...AS_WRITTEN, wholeWord: true }).length).toBe(4);
    expect(find(chapter, 'B\\w+t', { ...AS_WRITTEN, regexp: true }).map((m) => m.words)).toEqual([
      'Bennet',
      'Bennet',
    ]);
  });

  it('reads a pattern’s characters as themselves unless asked, and says a pattern can’t be read', () => {
    expect(find(chapter, 'Mr. Bennet,”').length).toBe(1);
    expect(find(chapter, '.*')).toEqual([]);
    expect(find(chapter, '(')).toEqual([]);
    expect(find(chapter, '\\')).toEqual([]);
    expect(find(chapter, '$^[]{}|/-+?')).toEqual([]);
    expect(matcherOf('(', { ...AS_WRITTEN, regexp: true })).toBe('invalid');
    expect(matcherOf('   ', AS_WRITTEN)).toBeNull();
  });

  it('never runs across two blocks, nor across a line break', () => {
    expect(find(chapter, 'wife. My')).toEqual([]);
    expect(find([element('p', [text('one'), element('br'), text('two')])], 'one two')).toEqual([]);
  });

  it('passes over a pattern’s match of nothing, never stuck on it', () => {
    expect(find(chapter, '^|x*', { ...AS_WRITTEN, regexp: true })).toEqual([]);
  });

  it('gives the words round a match, cut on whole words, an ellipsis where it was cut', () => {
    const [match] = find(chapter, 'possession');
    expect(match?.before.startsWith('…')).toBe(true);
    expect(match?.before.length).toBeLessThanOrEqual(CONTEXT.before + 1);
    expect(match?.before).not.toMatch(/^…\S*$/u);
    // Its block ends within the room after it: nothing cut, no ellipsis.
    expect(match?.after).toBe(' of a good fortune, must be in want of a wife.');
    const [first] = find(chapter, 'It is');
    expect(first?.before).toBe('');
    // 64 characters on, cut back to the last whole word.
    expect(first?.after).toBe(' a truth universally acknowledged, that a single man in…');
  });

  it('stops at the room it’s given, a Turkish İ never throwing', () => {
    expect(findIn(chapterBlocks(chapter), matcherOf('e', AS_WRITTEN) as RegExp, 0, 3)).toHaveLength(
      3,
    );
    const turkish = [element('p', [text('İstanbul and istanbul')])];
    expect(() => find(turkish, 'İstanbul')).not.toThrow();
    for (const match of find(turkish, 'istanbul')) expect(match.to - match.from).toBe(8);
  });
});

describe('Find in a chapter, as QA tried it (Phase 5c)', () => {
  const p = (...children: CleanNode[]) => element('p', children);
  /** The chapter's counted words, as a match's offsets index them. */
  const counted = (nodes: readonly CleanNode[]) =>
    nodes
      .flatMap(function flat(node): string[] {
        if (node.kind === 'text') return node.text.trim() === '' ? [] : [node.text];
        return node.children.flatMap(flat);
      })
      .join('');
  const PATTERN = { ...AS_WRITTEN, regexp: true };

  it('keeps a match’s offsets on its words past letters whose case changes their length', () => {
    // "İ" lower-cases to two characters; an emoji is two UTF-16 units: offsets are the text's own.
    const nodes = [p(text('İİ 😀 bell, İstanbul and ISTANBUL'))];
    const all = counted(nodes);
    const found = find(nodes, 'bell');
    expect(found.map((match) => all.slice(match.from, match.to))).toEqual(['bell']);
    for (const match of find(nodes, 'istanbul'))
      expect(all.slice(match.from, match.to).toLowerCase()).toBe('istanbul');
  });

  it('whole word holds for every branch of a pattern, and for letters beyond ASCII', () => {
    const nodes = [p(text('a woman, a man; cafés and a café'))];
    expect(find(nodes, 'a|man', { ...PATTERN, wholeWord: true }).map((m) => m.words)).toEqual([
      'a',
      'a',
      'man',
      'a',
    ]);
    const café = find(nodes, 'café', { ...AS_WRITTEN, wholeWord: true });
    expect(café.map((match) => match.from)).toEqual([counted(nodes).lastIndexOf('café')]);
    // "é" is a letter: "caf" is no whole word in "café".
    expect(find(nodes, 'caf', { ...AS_WRITTEN, wholeWord: true })).toEqual([]);
  });

  it('takes quotes as written in a pattern: alike only without Pattern', () => {
    const nodes = [p(text('“My dear,” she said; "my own"'))];
    // As a pattern, a straight quote is only itself: the curly one's words aren't found.
    expect(find(nodes, '"My', PATTERN).map((m) => m.words)).toEqual(['"my']);
    expect(find(nodes, '"my').map((m) => m.words)).toEqual(['“My', '"my']);
    expect(find(nodes, 'she said;').map((m) => m.words)).toEqual(['she said;']);
  });

  it('trims what’s typed as words, but reads a pattern’s spaces as its own', () => {
    const nodes = [p(text('a bell, abell'))];
    expect(find(nodes, '  bell  ').length).toBe(2);
    expect(find(nodes, ' bell', PATTERN).map((m) => m.from)).toEqual([1]);
  });

  it('never matches the space between two elements alone, which a place never counts', () => {
    const nodes = [p(element('em', [text('Mr.')]), text(' '), element('b', [text('Darcy')]))];
    expect(find(nodes, '\\s', PATTERN)).toEqual([]);
    // A match across it holds both words, its offsets the counted ones.
    const [match] = find(nodes, 'Mr. Darcy');
    expect(match && counted(nodes).slice(match.from, match.to)).toBe('Mr.Darcy');
  });

  it('finds nothing in a long chapter quickly, and ends on a 5,000-character query', () => {
    const long = Array.from({ length: 5000 }, (_, i) => p(text(`Word ${i} of a long chapter.`)));
    const started = performance.now();
    expect(find(long, 'zebra crossing')).toEqual([]);
    expect(find(long, 'x'.repeat(5000))).toEqual([]);
    expect(performance.now() - started).toBeLessThan(1000);
    const typed = `${'word '.repeat(999)}word`;
    expect(find([p(text(`${typed}.`))], typed)).toHaveLength(1);
  });

  it('cuts the words round a match at a block’s ends without an ellipsis', () => {
    const [match] = find([p(text('bell'))], 'bell');
    expect(match).toMatchObject({ before: '', words: 'bell', after: '' });
    // A word longer than the room after: the ellipsis alone, never half of it.
    const [long] = find([p(text(`bell ${'x'.repeat(100)}`))], 'bell');
    expect(long?.after).toBe('…');
  });

  it('counts a chapter of nothing but blank pieces as no blocks', () => {
    expect(chapterBlocks([text('\n  '), p(text('   '))])).toEqual([]);
  });
});
