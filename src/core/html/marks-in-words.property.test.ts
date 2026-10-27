// Paste escapes the page's marks only where they'd read as Markdown: words
// that Eien reads as words already paste as they are, and whatever is
// pasted shows the page's words.

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { eienParser, footnoteRefs, isLink, referenceLabels } from '../markdown';
import { fromHtml } from './from-html';
import { escapeHtml } from './html';
import { toHtml } from './to-html';

/** Words, and the marks that make Markdown inside a line, alone and in pairs. */
const token = fc.constantFrom(
  'scarf',
  'Needle',
  '2',
  '[1]',
  '[sic]',
  '[',
  ']',
  '(',
  ')',
  '*',
  '**',
  '_',
  '~',
  '~~',
  '^',
  '==',
  '`',
  '<',
  '<b>',
  '&',
  '&amp;',
  '!',
  '\\',
  'x^2',
  'a==b',
);
const words = fc
  .array(fc.tuple(token, fc.constantFrom(' ', '')), { minLength: 1, maxLength: 10 })
  .map((parts) =>
    parts
      .map(([t, space]) => t + space)
      .join('')
      .trim(),
  );

/**
 * Whether Eien reads `text` as nothing but words: no mark, tag, entity,
 * escape, footnote or link (an empty "( )" makes one too).
 */
function readsAsWords(text: string): boolean {
  const tree = eienParser.parse(text);
  const slice = (from: number, to: number) => text.slice(from, to);
  const references = referenceLabels(tree, slice);
  const footnotes = footnoteRefs(text).map((ref) => ref.from);
  let words = true;
  tree.iterate({
    enter(node) {
      if (node.name === 'Document' || node.name === 'Paragraph') return undefined;
      // Brackets that link nowhere are words; what's inside them is read on.
      const plainLink = (link: typeof node.node | null) =>
        (link?.name === 'Link' || link?.name === 'Image') &&
        !isLink(link, slice, references) &&
        !footnotes.includes(link.from) &&
        !link.getChildren('LinkMark').some((mark) => slice(mark.from, mark.to) === '(');
      if (plainLink(node.node)) return undefined;
      if (/^Link(?:Mark|Label)$/u.test(node.name) && plainLink(node.node.parent)) return false;
      words = false;
      return false;
    },
  });
  return words;
}

const page = (text: string) => `<p>${escapeHtml(text)}</p>`;

describe('the page’s marks, pasted', () => {
  it('paste as they are where they read as words', () => {
    fc.assert(
      fc.property(words.filter(readsAsWords), (text) => {
        expect(fromHtml(page(text))).toBe(text);
      }),
    );
  });

  it('show the page’s words wherever they are', () => {
    fc.assert(
      fc.property(words, (text) => {
        const shown = toHtml(fromHtml(page(text)), { quotes: 'straight', sceneBreak: 'spacer' });
        expect(shown).toBe(page(text).replace(/\s+/gu, ' '));
      }),
    );
  });
});
