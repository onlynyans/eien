// What holds for any link edit (backlog #38): the text round the link is
// never touched; what was typed reads back from the link it made; the caret
// ends in that link; and the change is a link the parser reads as one.

import { EditorState } from '@codemirror/state';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { caretLink, linkAt, linkEdit } from './link-core';
import { eienMarkdown } from './syntax';

const stateOf = (text: string) => EditorState.create({ doc: text, extensions: [eienMarkdown()] });

const BEFORE = 'Before the link, ';
const AFTER = ' and after it.';
const STARTS = [
  `${BEFORE}[the gate](https://a.org/gate)${AFTER}`,
  `${BEFORE}[[Below the Gate|iii]]${AFTER}`,
  `${BEFORE}[[Below the Gate]]${AFTER}`,
  `${BEFORE}<https://a.org>${AFTER}`,
];

/** Words a writer might type: letters, spaces, marks, brackets, a backslash. */
const words = fc
  .array(fc.constantFrom(...'ab Z*_[]()\\|!é·'.split('')), { minLength: 1, maxLength: 16 })
  .map((chars) => chars.join(''))
  .filter((typed) => /[a-zé]/i.test(typed) && typed.trim() === typed);
const address = fc
  .tuple(fc.constantFrom('a.org', 'archiveofourown.org', 'b.example'), fc.webPath())
  .map(([host, path]) => `https://${host}${path}`)
  .filter((typed) => !/[<>\\]/.test(typed));
const name = fc
  .array(fc.constantFrom(...'ab Z.é'.split('')), { minLength: 1, maxLength: 12 })
  .map((chars) => chars.join('').trim())
  .filter(
    (typed) =>
      /[a-zé]/i.test(typed) && !/\s{2}/.test(typed) && !/^[\w.-]+\.[a-z]{2,}$/i.test(typed),
  );

/** The words as the page reads them: a backslash before a bracket or a backslash is that character. */
const read = (written: string) => written.replace(/\\([\\[\]])/g, '$1');

describe('any link edit', () => {
  it('leaves the text round the link, and reads back what was typed', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...STARTS),
        fc.option(words, { nil: undefined }),
        fc.option(fc.oneof(address, name), { nil: undefined }),
        (start, typedWords, goesTo) => {
          const state = stateOf(start);
          const link = linkAt(state, BEFORE.length + 1);
          if (!link) throw new Error('no link');
          const spec = linkEdit(state, link, {
            ...(typedWords === undefined ? {} : { words: typedWords }),
            ...(goesTo === undefined ? {} : { goesTo }),
          });
          if (!spec) return;
          const next = state.update(spec).state;
          const text = next.doc.toString();
          expect(text.startsWith(BEFORE)).toBe(true);
          expect(text.endsWith(AFTER)).toBe(true);
          const made = caretLink(next, next.selection.main.head);
          expect(made).not.toBeNull();
          if (!made) return;
          expect(made.from).toBe(BEFORE.length);
          expect(made.to).toBe(text.length - AFTER.length);
          if (goesTo !== undefined) expect(made.goesTo).toBe(goesTo);
          if (typedWords !== undefined && made.kind === 'web')
            expect(read(made.words)).toBe(read(typedWords));
        },
      ),
    );
  });
});
