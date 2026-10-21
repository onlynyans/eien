// The page's tag edits (backlog #13): only front matter's `tags:` changes,
// in the shape the writer wrote it, and never the words; a #tag typed in
// the text stays.

import { describe, expect, it } from 'vitest';
import { noteTags } from '../note';
import { withTagAdded, withTagRemoved } from './front-tags';

describe('adding a tag', () => {
  it('makes front matter for a note that has none, the text after it as it was', () => {
    expect(withTagAdded('Words.\n', 'draft')).toBe('---\ntags: [draft]\n---\nWords.\n');
    expect(withTagAdded('', 'draft')).toBe('---\ntags: [draft]\n---\n');
  });

  it('adds a tags key last, every other line kept byte for byte', () => {
    const text = '---\ntitle: "A: b"  # kept\nid: AB12345678\n---\nWords.';
    expect(withTagAdded(text, 'draft')).toBe(
      '---\ntitle: "A: b"  # kept\nid: AB12345678\ntags: [draft]\n---\nWords.',
    );
    expect(withTagAdded('---\n---\nWords.', 'draft')).toBe('---\ntags: [draft]\n---\nWords.');
  });

  it('adds to a list in the shape it is written in', () => {
    expect(withTagAdded('---\ntags: [a, b]\n---\n', 'c')).toBe('---\ntags: [a, b, c]\n---\n');
    expect(withTagAdded('---\ntags: []\n---\n', 'c')).toBe('---\ntags: [c]\n---\n');
    expect(withTagAdded('---\ntags:\n  - a\n  - b\nid: X\n---\n', 'c')).toBe(
      '---\ntags:\n  - a\n  - b\n  - c\nid: X\n---\n',
    );
    expect(withTagAdded('---\ntags:\n- a\n---\n', 'c')).toBe('---\ntags:\n- a\n- c\n---\n');
  });

  it('adds to tags written as words, with the separator the writer used', () => {
    expect(withTagAdded('---\ntags: a, b\n---\n', 'c')).toBe('---\ntags: a, b, c\n---\n');
    expect(withTagAdded('---\ntags: a b\n---\n', 'c')).toBe('---\ntags: a b c\n---\n');
    expect(withTagAdded('---\ntags: a\n---\n', 'c')).toBe('---\ntags: a, c\n---\n');
    expect(withTagAdded('---\ntags: "a b"\n---\n', 'c')).toBe('---\ntags: "a b c"\n---\n');
  });

  it('fills an empty tags key', () => {
    expect(withTagAdded('---\ntags:\nid: X\n---\n', 'c')).toBe('---\ntags: [c]\nid: X\n---\n');
    expect(withTagAdded('---\ntags: ~\n---\n', 'c')).toBe('---\ntags: [c]\n---\n');
    expect(withTagAdded("---\ntags: ''\n---\n", 'c')).toBe('---\ntags: [c]\n---\n');
  });

  it('changes nothing for a tag already there, whatever its case', () => {
    const text = '---\ntags: [Draft]\n---\n';
    expect(withTagAdded(text, 'draft')).toBe(text);
    expect(withTagAdded(text, '#DRAFT')).toBe(text);
  });

  it('adds a tag the text already has inline to front matter, the words untouched', () => {
    const text = '---\ntags: [a]\n---\nA scene. #draft\n';
    const next = withTagAdded(text, 'draft');
    expect(next).toBe('---\ntags: [a, draft]\n---\nA scene. #draft\n');
    expect(noteTags(next ?? '')).toEqual({ front: ['a', 'draft'], inline: [] });
  });

  it('takes the tag tidied, its # off', () => {
    expect(withTagAdded('', '#fic//aot/')).toBe('---\ntags: [fic/aot]\n---\n');
  });

  it('refuses what is not a tag, or front matter it cannot add to without rewriting it', () => {
    expect(withTagAdded('', '123')).toBeNull();
    expect(withTagAdded('', 'two words')).toBeNull();
    expect(withTagAdded('---\n- a list\n---\n', 'c')).toBeNull();
    expect(withTagAdded('---\ntags: [a\n---\n', 'c')).toBeNull(); // broken YAML
    expect(withTagAdded('---\ntags: |\n  a\n---\n', 'c')).toBeNull();
    expect(withTagAdded('---\ntags: [a]\ntags: [b]\n---\n', 'c')).toBeNull();
    expect(withTagAdded('---\ntags: {a: 1}\n---\n', 'c')).toBeNull();
  });
});

describe('removing a tag', () => {
  it('takes it out of a list, with its comma', () => {
    expect(withTagRemoved('---\ntags: [a, b, c]\n---\n', 'b')).toBe('---\ntags: [a, c]\n---\n');
    expect(withTagRemoved('---\ntags: [a, b]\n---\n', 'a')).toBe('---\ntags: [b]\n---\n');
    expect(withTagRemoved('---\ntags: [a]\n---\nx', 'a')).toBe('---\ntags: []\n---\nx');
  });

  it('takes its line out of a block list', () => {
    expect(withTagRemoved('---\ntags:\n  - a\n  - b\nid: X\n---\n', 'a')).toBe(
      '---\ntags:\n  - b\nid: X\n---\n',
    );
    expect(withTagRemoved('---\ntags:\n  - a\n  - b\n---\n', 'b')).toBe('---\ntags:\n  - a\n---\n');
  });

  it('takes it out of tags written as words', () => {
    expect(withTagRemoved('---\ntags: a, b, c\n---\n', 'b')).toBe('---\ntags: a, c\n---\n');
    expect(withTagRemoved('---\ntags: a b\n---\n', 'a')).toBe('---\ntags: b\n---\n');
    expect(withTagRemoved('---\ntags: a\n---\n', 'a')).toBe('---\ntags: []\n---\n');
  });

  it('matches case aside, and takes every writing of it', () => {
    expect(withTagRemoved('---\ntags: [Draft, a, draft]\n---\n', 'DRAFT')).toBe(
      '---\ntags: [a]\n---\n',
    );
    expect(withTagRemoved('---\ntags: ["#Straße"]\n---\n', 'STRASSE')).toBe('---\ntags: []\n---\n');
  });

  it('never touches the words: a tag typed in the text stays', () => {
    const text = '---\ntags: [draft]\n---\nA scene. #draft\n';
    const next = withTagRemoved(text, 'draft');
    expect(next).toBe('---\ntags: []\n---\nA scene. #draft\n');
    expect(noteTags(next ?? '')).toEqual({ front: [], inline: ['draft'] });
    // A tag only in the text: there is nothing in front matter to take off.
    expect(withTagRemoved('Only #draft here.', 'draft')).toBe('Only #draft here.');
  });

  it('keeps every other key, comment and line as it was', () => {
    const text = '---\n# a comment\ntitle: x\ntags: [a, b] # mine\nid: X\n---\nWords.';
    expect(withTagRemoved(text, 'a')).toBe(
      '---\n# a comment\ntitle: x\ntags: [b] # mine\nid: X\n---\nWords.',
    );
  });

  it('refuses front matter it cannot read', () => {
    expect(withTagRemoved('---\ntags: [a\n---\n', 'a')).toBe('---\ntags: [a\n---\n'); // no tags read
    expect(withTagRemoved('---\ntags: [a]\ntags: [a]\n---\n', 'a')).toBeNull();
  });
});

describe('a note’s two kinds of tag', () => {
  it('tells front matter’s from the text’s, each once, front matter first', () => {
    expect(noteTags('---\ntags: [a, A, b]\n---\n#b #c and #C `#code`')).toEqual({
      front: ['a', 'b'],
      inline: ['c'],
    });
  });
});
