// Adversarial: finding footnotes (spec §8) where the editor's parser and
// splitFootnotes read a line differently. Fails on the code as it stands.

import { describe, expect, it } from 'vitest';
import { bookBlocks } from '../ao3';
import { splitFootnotes } from './footnotes';

describe('splitFootnotes and the parser agree on what a fence is', () => {
  it('finds the notes after a line that starts with ``` but is no fence (backticks after it)', () => {
    // CommonMark: a backtick fence's info string can't hold a backtick, so this is a paragraph
    // with inline code; the editor and the exports show it so.
    const line = '```js` is how the tutorial wrote it.';
    expect(bookBlocks(line, 'straight')).toEqual(['<p>```js` is how the tutorial wrote it.</p>']);
    const split = splitFootnotes(`${line}\n\nShe mended it.[^1]\n\n[^1]: The note.`);
    expect(split.notes.get('1')).toBe('The note.'); // a note, not the words "[^1]: The note."
  });
});
