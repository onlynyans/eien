import { describe, expect, it } from 'vitest';
import { countWords, formatOf, fromEditor, frontMatterEnd, PLAIN_FORMAT, toEditor } from './index';

describe('format: a file written back is the file read', () => {
  it.each([
    ['plain LF', 'One.\nTwo.\n'],
    ['CRLF', 'One.\r\nTwo.\r\n'],
    ['BOM and LF', '﻿One.\nTwo.'],
    ['BOM and CRLF', '﻿One.\r\nTwo.\r\n'],
    ['no line ending at all', 'One line'],
    ['empty', ''],
    ['only a BOM', '﻿'],
    ['blank lines', '\n\n\n'],
    ['CRLF blank lines', '\r\n\r\n'],
    ['emoji and CJK', '永遠 🧣\r\nforever\r\n'],
  ])('%s', (_, raw) => {
    const format = formatOf(raw);
    const text = toEditor(raw);
    expect(text.includes('\r')).toBe(false);
    expect(text.startsWith('﻿')).toBe(false);
    expect(fromEditor(text, format)).toBe(raw);
  });

  it('takes the line ending most lines use', () => {
    expect(formatOf('a\r\nb\r\nc\n').eol).toBe('\r\n');
    expect(formatOf('a\nb\nc\r\n').eol).toBe('\n');
  });

  it('turns old-Mac "\\r" line endings into lines too', () => {
    expect(toEditor('one\rtwo')).toBe('one\ntwo');
  });

  it('writes edits in the file’s own line ending', () => {
    const format = formatOf('a\r\nb\r\n');
    expect(fromEditor('a\nb\nnew line\n', format)).toBe('a\r\nb\r\nnew line\r\n');
  });

  it('writes a new note plainly', () => {
    expect(fromEditor('Hello\n', PLAIN_FORMAT)).toBe('Hello\n');
  });
});

describe('frontMatterEnd', () => {
  it('finds the end of a front matter block', () => {
    const text = '---\nid: 1\ntags: [a]\n---\nBody';
    expect(text.slice(frontMatterEnd(text))).toBe('Body');
  });

  it('accepts "..." as the closing line, and a closing line at the very end', () => {
    expect(frontMatterEnd('---\na: 1\n...\nBody')).toBe('---\na: 1\n...\n'.length);
    expect(frontMatterEnd('---\na: 1\n---')).toBe('---\na: 1\n---'.length);
  });

  it.each([
    ['no front matter', 'Just text'],
    ['a rule in the body, not at the start', 'Text\n---\nMore'],
    ['an opening with no close', '---\nnever closed\n'],
    ['four dashes is not an opening', '----\na: 1\n---\n'],
  ])('is 0 for %s', (_, text) => {
    expect(frontMatterEnd(text)).toBe(0);
  });
});

describe('countWords', () => {
  it.each([
    ['', 0],
    ['   \n\t ', 0],
    ['One two three.', 3],
    ["Don't stop — keep going.", 4],
    ['It takes a long time—to the point the fire dims.', 11],
    ['"...Thank you, Captain."', 3],
    ['**Bold** and *italic* and ~~gone~~.', 5],
    ['# Heading\n\n- [ ] a task', 3],
    ['***', 0],
    ['l’homme et l’enfant', 3], // elided words count as one, as word processors count them
    ['42 stitches', 2],
  ])('%j has %i words', (text, words) => {
    expect(countWords(text)).toBe(words);
  });

  it('counts words in languages without spaces', () => {
    expect(countWords('永遠に')).toBeGreaterThan(0);
  });

  it('leaves front matter out', () => {
    expect(countWords('---\ntags: [fic, draft]\ntitle: Something long here\n---\nTwo words')).toBe(
      2,
    );
  });
});
