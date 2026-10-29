import { describe, expect, it } from 'vitest';
import {
  asAddress,
  isAddress,
  linkAddress,
  linkWords,
  webLink,
  wikiLink,
  wikiParts,
} from './link-source';

describe('isAddress', () => {
  it.each([
    'https://archiveofourown.org/works/1',
    'http://example.org',
    'mailto:rook@example.org',
    'www.example.org',
    'example.org',
    'fandom.wiki/Beneath_the_Walls',
    ' example.org/a?b=c ',
    'https://a.org/x y',
  ])('reads %j as an address', (typed) => expect(isAddress(typed)).toBe(true));

  it.each([
    'Below the Gate',
    'iii',
    'What the Recruits Say',
    'v1.0',
    'Chapter 1.2',
    '',
    'a b.org',
    'Re: the gate',
    'Re:gate',
  ])('reads %j as a note’s name', (typed) => expect(isAddress(typed)).toBe(false));
});

describe('asAddress', () => {
  it('takes a bare site as the web’s, and keeps a scheme', () => {
    expect(asAddress('example.org/a')).toBe('https://example.org/a');
    expect(asAddress('www.example.org')).toBe('https://www.example.org');
    expect(asAddress(' mailto:a@b.org ')).toBe('mailto:a@b.org');
  });
});

describe('wikiLink', () => {
  it('names the note, and the words only when they differ', () => {
    expect(wikiLink('Below the Gate', 'Below the Gate')).toBe('[[Below the Gate]]');
    expect(wikiLink('Below the Gate', '')).toBe('[[Below the Gate]]');
    expect(wikiLink('What the Recruits Say', 'chapter iv')).toBe(
      '[[What the Recruits Say|chapter iv]]',
    );
  });

  it('drops what a wiki link can’t hold', () => {
    expect(wikiLink('A [b] | c', 'one ]] two\nthree')).toBe('[[A b c|one two three]]');
    expect(wikiLink('Note', 'a | b')).toBe('[[Note|a | b]]');
  });
});

describe('webLink', () => {
  it('writes the words and the address', () => {
    expect(webLink('AO3', 'https://archiveofourown.org')).toBe(
      '[AO3](https://archiveofourown.org)',
    );
  });

  it('gives a link with no words its address, so it never vanishes', () => {
    expect(webLink('  ', 'https://a.org')).toBe('[https://a.org](https://a.org)');
  });

  it('escapes brackets in the words, once', () => {
    expect(linkWords('a [b] c')).toBe('a \\[b\\] c');
    expect(linkWords('a \\[b\\] c')).toBe('a \\[b\\] c');
    expect(linkWords('a \\\\[b')).toBe('a \\\\\\[b');
    expect(linkWords('a\\')).toBe('a\\\\');
    expect(linkWords('a\\\\')).toBe('a\\\\');
  });

  it('puts an address with spaces or brackets in <…>', () => {
    expect(linkAddress('https://a.org/x y')).toBe('<https://a.org/x y>');
    expect(linkAddress('https://a.org/(x)')).toBe('<https://a.org/(x)>');
    expect(linkAddress('https://a.org/<x>')).toBe('<https://a.org/%3Cx%3E>');
    expect(linkAddress('https://a.org/x')).toBe('https://a.org/x');
  });
});

describe('wikiParts', () => {
  it('parts the name from the words at the first |', () => {
    expect(wikiParts('Note|the words')).toEqual({ note: 'Note', words: 'the words' });
    expect(wikiParts('Note|a|b')).toEqual({ note: 'Note', words: 'a|b' });
    expect(wikiParts('Note')).toEqual({ note: 'Note', words: 'Note' });
  });
});
