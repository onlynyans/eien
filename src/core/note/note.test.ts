// What the list shows of a note without opening it: a preview with the
// marks taken out, its words, its tags.

import { describe, expect, it } from 'vitest';
import { readMarkdown } from '../markdown';
import { PREVIEW_LENGTH, readNote } from './index';

/** A body's plain text as its lines, each trimmed, spaces collapsed, blank lines gone. */
const linesOf = (body: string) =>
  readMarkdown(body)
    .plain.split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

describe('plain text', () => {
  it('takes the marks out and keeps the words', () => {
    expect(linesOf('# Title\n\nA **bold** and *soft* ~~gone~~ ==lit== H~2~O x^2^ word.')).toEqual([
      'Title',
      'A bold and soft gone lit H2O x2 word.',
    ]);
    expect(
      linesOf('> quoted\n- [ ] Summary\n- [x] Tags\n1. first\n\n| a | b |\n|---|---|\n| 1 | 2 |'),
    ).toEqual(['quoted', 'Summary', 'Tags', 'first', 'a b', '1 2']);
  });

  it('keeps a link’s words but not its address; drops an image; keeps a bare address', () => {
    expect(linesOf('See [the archive](https://ao3.org "AO3") and ![cover](c.png).')).toEqual([
      'See the archive and .',
    ]);
    expect(linesOf('Go to https://ao3.org or <https://x.org>.')).toEqual([
      'Go to https://ao3.org or https://x.org.',
    ]);
    expect(linesOf('[[Ideas — winter arc]] and [ref][1]\n\n[1]: https://x.org "title"')).toEqual([
      'Ideas — winter arc and ref',
    ]);
  });

  it('keeps code’s text, without the fences or the language', () => {
    expect(linesOf('Use `npm test`.\n\n```js\nlet x = 1;\n```')).toEqual([
      'Use npm test.',
      'let x = 1;',
    ]);
  });

  it('takes HTML tags out but keeps their words, inline and in a block', () => {
    expect(linesOf('the <u>merciless</u> work<br>')).toEqual(['the merciless work']);
    expect(linesOf('<p>AO3 <em>pasted</em></p>')).toEqual(['AO3 pasted']);
    expect(linesOf('<!-- a comment -->\nafter')).toEqual(['after']);
  });

  it('reads an escaped mark as the character', () => {
    expect(linesOf('\\*not italic\\* and 2\\*3')).toEqual(['*not italic* and 2*3']);
  });

  it('copes with empty, mark-only and unclosed text', () => {
    expect(linesOf('')).toEqual([]);
    expect(linesOf('***\n\n---')).toEqual([]);
    expect(linesOf('**unclosed and `open')).toEqual(['**unclosed and `open']);
  });
});

describe('readNote', () => {
  it('previews the first words, skipping a first line that repeats the title', () => {
    expect(readNote('# Seventeen\n\n"Look," he begins.', 'Seventeen').preview).toBe(
      '"Look," he begins.',
    );
    expect(readNote('# Chapter One\n\nIt begins.', 'Seventeen').preview).toBe(
      'Chapter One It begins.',
    );
  });

  it('previews after the front matter, and a checklist as its items', () => {
    expect(readNote('---\ntags: [x]\n---\n\nBody here.', 'N').preview).toBe('Body here.');
    expect(readNote('- [ ] Summary\n- [x] Tags\n- [ ] Post', 'N').preview).toBe(
      'Summary Tags Post',
    );
  });

  it('has an empty preview for an empty note, a blank one, or only front matter', () => {
    for (const raw of ['', '\n\n  \n', '---\nid: 1\n---\n', '# Title only', '﻿']) {
      expect(readNote(raw, 'Title only').preview).toBe('');
    }
  });

  it('keeps a preview short, without splitting an emoji', () => {
    const long = readNote(`${'🧣'.repeat(PREVIEW_LENGTH + 20)}`, 'N').preview;
    expect([...long].length).toBe(PREVIEW_LENGTH);
    expect(long.endsWith('🧣')).toBe(true);
  });

  it('counts words as the page does, front matter left out', () => {
    expect(readNote('---\ntags: [a, b, c]\n---\nOne two three.', 'N').words).toBe(3);
    expect(readNote('l’homme et la femme', 'N').words).toBe(4);
  });

  it('reads CRLF and old Mac line endings, and a byte-order mark', () => {
    const note = readNote('﻿# T\r\n\r\nFirst line\rsecond #tag\r\n', 'T');
    expect(note.preview).toBe('First line second #tag');
    expect(note.tags).toEqual(['tag']);
  });

  it('reads a large note in reasonable time', () => {
    const raw = `${'A line with **bold** and a #tag and [a link](x).\n\n'.repeat(20_000)}`;
    const started = performance.now();
    const note = readNote(raw, 'Big');
    expect(note.tags).toEqual(['tag']);
    expect(performance.now() - started).toBeLessThan(3000);
  });
});
