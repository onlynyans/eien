// Adversarial: word counts with the Markdown and HTML marks the editor itself
// writes (spec §11: "Markdown marks and front matter excluded").

import { describe, expect, it } from 'vitest';
import { countWords } from './index';

describe('countWords leaves the marks out', () => {
  it.each([
    // ⌘U writes <u>…</u> around a word: underlining must not add two words.
    ['<u>word</u>', 1],
    ['a <u>merciless</u> work', 3],
    // A ticked checklist item: the "x" in "[x]" is a mark, as the space in "[ ]" is.
    ['- [x] a task', 2],
    ['- [X] a task', 2],
    // ⌘K writes [words](address): the address is not words on the page.
    ['[the archive](https://archiveofourown.org/works/1)', 2],
  ])('%j has %i words', (text, words) => {
    expect(countWords(text)).toBe(words);
  });
});
