import { describe, expect, it } from 'vitest';
import { footnoteKey, footnoteRefs, splitFootnotes } from './footnotes';

const keys = (text: string) => footnoteRefs(text).map((ref) => ref.key);

describe('splitFootnotes', () => {
  it('takes a definition out, leaving its lines blank', () => {
    const split = splitFootnotes('Text.[^1]\n\n[^1]: The note.\n\nMore.');
    expect(split.text).toBe('Text.[^1]\n\n\n\nMore.');
    expect([...split.notes]).toEqual([['1', 'The note.']]);
  });

  it('carries on with indented lines, and a lazy line of its first paragraph', () => {
    const split = splitFootnotes(
      ['[^a]: First line', 'lazy line', '', '    Second paragraph.', '', 'After.'].join('\n'),
    );
    expect(split.notes.get('a')).toBe('First line\nlazy line\n\nSecond paragraph.');
    expect(split.text).toBe('\n\n\n\n\nAfter.');
  });

  it('stops at a blank line, a heading, a list, a quote or another definition', () => {
    for (const after of ['', '# Heading', '- item', '> quote', '[^b]: Another.', '***']) {
      const split = splitFootnotes(`[^a]: Note.\n${after}`);
      expect(split.notes.get('a')).toBe('Note.');
    }
    expect(splitFootnotes('[^a]: One.\n[^b]: Two.').notes.get('b')).toBe('Two.');
  });

  it('matches labels case aside; the first definition counts, a later one stays as words', () => {
    const split = splitFootnotes('[^Note]: First.\n\n[^note]: Second.');
    expect([...split.notes]).toEqual([['note', 'First.']]);
    expect(split.text).toBe('\n\n[^note]: Second.');
    expect(footnoteKey('ÉTÉ')).toBe('été');
  });

  it('finds none in fenced code, and none indented four spaces (code)', () => {
    const fenced = '```\n[^1]: Not a note.\n```\n';
    expect(splitFootnotes(fenced)).toEqual({ text: fenced, notes: new Map() });
    expect(splitFootnotes('    [^1]: Code.').notes.size).toBe(0);
    expect(splitFootnotes('   [^1]: Three spaces is a note.').notes.get('1')).toBe(
      'Three spaces is a note.',
    );
  });

  it('wants a space (or the line’s end) after the colon, and a label with no spaces', () => {
    expect(splitFootnotes('[^1]:no space').notes.size).toBe(0);
    expect(splitFootnotes('[^a b]: spaced').notes.size).toBe(0);
    expect(splitFootnotes('[^1]:').notes.get('1')).toBe('');
  });
});

describe('footnoteRefs', () => {
  it('finds marks, side by side too', () => {
    expect(keys('One[^1] two[^Two][^1].')).toEqual(['1', 'two', '1']);
  });

  it('skips code, addresses, tags and escaped brackets', () => {
    expect(keys('`a[^1]`')).toEqual([]);
    expect(keys('```\n[^1]\n```')).toEqual([]);
    expect(keys('<https://example.com/[^1]>')).toEqual([]);
    expect(keys('<span title="[^1]">x</span>')).toEqual([]);
    expect(keys('<div title="[^1]">\nWords[^2]\n</div>')).toEqual(['2']);
    expect(keys('\\[^1] and \\\\[^2]')).toEqual(['2']);
  });

  it('gives where each is', () => {
    expect(footnoteRefs('ab[^x]')).toEqual([{ from: 2, to: 6, key: 'x' }]);
  });
});
