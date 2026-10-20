// Properties of the inline marks over generated prose: pressed twice, a mark
// gives the text back; pressed once, the editor's parser reads the mark where
// it was put, with no stray "*" or "==" left on the page.

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { readMarkdown } from '../markdown';
import {
  apply,
  BOLD,
  HIGHLIGHT,
  type InlineMark,
  ITALIC,
  type Selection,
  STRIKE,
  toggleInline,
  UNDERLINE,
} from './index';

const MARKS: Record<string, InlineMark> = {
  bold: BOLD,
  italic: ITALIC,
  underline: UNDERLINE,
  strike: STRIKE,
  highlight: HIGHLIGHT,
};

const letter = fc.constantFrom('a', 'k', 'é', 'e\u0301', 'ß', 'Ж', 'σ', '永', 'り', '7');
const word = fc.array(letter, { minLength: 1, maxLength: 5 }).map((l) => l.join(''));
const gap = fc.constantFrom(' ', ' ', ', ', '. ', '; ', ' — ', '’', "'", '-', '!', ' (', ') ');
/** Marks and Markdown a line can hold already, so a mark is tried beside them. */
const other = fc.constantFrom('**', '*', '==', '~~', '<u>', '</u>', '`', '_', '[', ']');
const prefix = fc.constantFrom('', '', '', '# ', '## ', '> ', '- ', '* ', '1. ', '- [ ] ', '  ');
const sceneBreak = fc.constantFrom('***', '* * *', '---', '___');

/** Lines of `part`s and scene breaks. Single spaces: four at a line's start make code, where marks are text. */
const textOf = (part: fc.Arbitrary<string>) => {
  const line = fc.oneof(
    { weight: 9, arbitrary: fc.tuple(prefix, fc.array(part, { maxLength: 12 })) },
    { weight: 1, arbitrary: fc.tuple(sceneBreak, fc.constant([])) },
  );
  return fc
    .array(
      line.map(([start, parts]) => (start + parts.join('')).replace(/ {2,}/g, ' ')),
      { minLength: 1, maxLength: 4 },
    )
    .map((lines) => lines.join('\n'));
};

/** `text` and a selection in it (the letters are all in the Basic Multilingual Plane). */
const selected = (text: fc.Arbitrary<string>) =>
  text.chain((t) =>
    fc
      .tuple(fc.nat({ max: t.length }), fc.nat({ max: t.length }))
      .map(([a, b]) => ({ text: t, selection: { from: Math.min(a, b), to: Math.max(a, b) } })),
  );

const toggle = (text: string, selection: Selection, mark: InlineMark) => {
  const edit = toggleInline(text, selection, mark);
  return { text: apply(text, edit.changes), selection: edit.selection };
};

describe('an inline mark pressed twice gives the text back', () => {
  const prose = selected(textOf(fc.oneof({ weight: 6, arbitrary: word }, gap, other)));
  for (const [name, mark] of Object.entries(MARKS)) {
    it(name, () => {
      const markChars = new Set([...mark.open, ...mark.close]);
      const chars = [...markChars].join('');
      const inWord = new RegExp(`[\\p{L}\\p{M}\\p{N}_'’-][${chars}]+[\\p{L}\\p{M}\\p{N}_'’-]`, 'u');
      fc.assert(
        fc.property(prose, ({ text, selection }) => {
          // A selection holding marks of its own kind is marked whole ("**a** and **b**"
          // → "**a and b**"), as a word processor's Bold is: that one doesn't come back.
          fc.pre(![...text.slice(selection.from, selection.to)].some((c) => markChars.has(c)));
          // A caret takes the word around it, and "un*believ*able" unmarked is one word.
          fc.pre(selection.from < selection.to || !inWord.test(text));
          const once = toggle(text, selection, mark);
          const twice = toggle(once.text, once.selection, mark);
          expect(twice.text).toBe(text);
        }),
      );
    });
  }
});

describe('an inline mark pressed once is read as that mark', () => {
  const prose = selected(textOf(fc.oneof({ weight: 3, arbitrary: word }, gap)));
  for (const [name, mark] of Object.entries(MARKS)) {
    it(name, () => {
      fc.assert(
        fc.property(prose, ({ text, selection }) => {
          // A caret takes the word it touches; away from words it gets an empty pair to type into.
          const { from, to } = selection;
          fc.pre(
            /\p{L}/u.test(
              text.slice(from < to ? from : Math.max(0, from - 1), Math.max(to, from + 1)),
            ),
          );
          const once = toggle(text, selection, mark);
          expect(readMarkdown(once.text).plain).toBe(readMarkdown(text).plain);
        }),
      );
    });
  }
});
