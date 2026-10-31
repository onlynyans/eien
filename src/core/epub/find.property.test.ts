// Over generated chapters and anything typed: Find never throws, its matches
// stay within the chapter's words, in order, each its own words; and a run of
// a paragraph's words is always found where it is.

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { CleanNode } from '../html';
import { chapterBlocks } from './book-text';
import { countChapter } from './chapter-count';
import { AS_WRITTEN, findIn, matcherOf } from './find';

const word = fc.stringMatching(/^[A-Za-zé’“”.,]{1,9}$/u);
const run = fc.array(word, { minLength: 1, maxLength: 8 }).map((words) => words.join(' '));

/** A chapter of paragraphs, each words, some in an inline element, blank runs between. */
const chapter = fc
  .array(
    fc.array(
      fc.oneof(
        run,
        run.map((words) => ({ em: words })),
      ),
      { minLength: 1, maxLength: 5 },
    ),
    { minLength: 1, maxLength: 6 },
  )
  .map((paragraphs): CleanNode[] =>
    paragraphs.map((parts) => ({
      kind: 'element',
      name: 'p',
      attrs: {},
      children: parts.flatMap((part): CleanNode[] => [
        typeof part === 'string'
          ? { kind: 'text', text: part }
          : { kind: 'element', name: 'em', attrs: {}, children: [{ kind: 'text', text: part.em }] },
        { kind: 'text', text: ' ' },
      ]),
    })),
  );

/** The chapter's counted words, as offsets index them. */
const counted = (nodes: readonly CleanNode[]): string =>
  nodes
    .flatMap(function flat(node): string[] {
      if (node.kind === 'text') return node.text.trim() === '' ? [] : [node.text];
      return node.children.flatMap(flat);
    })
    .join('');

describe('Find over any chapter', () => {
  it('never throws, its matches in order within the chapter, whatever is typed', () => {
    fc.assert(
      fc.property(chapter, fc.string({ maxLength: 12 }), fc.boolean(), (nodes, typed, pattern) => {
        const matcher = matcherOf(typed, { ...AS_WRITTEN, regexp: pattern });
        if (matcher === null || matcher === 'invalid') return;
        const found = findIn(chapterBlocks(nodes), matcher, 0);
        const length = countChapter(nodes).length;
        let last = -1;
        for (const match of found) {
          expect(match.from).toBeLessThan(match.to);
          expect(match.to).toBeLessThanOrEqual(length);
          expect(match.from).toBeGreaterThanOrEqual(last);
          last = match.from;
        }
      }),
    );
  });

  it('finds a run of one piece’s words where it is, its offsets holding those words', () => {
    fc.assert(
      fc.property(chapter, fc.nat(), fc.nat(), (nodes, pick, cut) => {
        const words = counted(nodes);
        const blocks = chapterBlocks(nodes);
        const pieces = blocks
          .flatMap((block) => block.text.split(/\s{2,}| (?=\S)/u))
          .filter(Boolean);
        const piece = pieces[pick % pieces.length] ?? '';
        const query = piece.slice(0, 1 + (cut % Math.max(1, piece.length))).trim();
        const matcher = matcherOf(query, { ...AS_WRITTEN, caseSensitive: true });
        if (matcher === null || matcher === 'invalid') return;
        const found = findIn(chapterBlocks(nodes), matcher, 0);
        expect(found.length).toBeGreaterThan(0);
        for (const match of found) {
          // Quotes are alike, so the chapter's own may stand where the query had another.
          const fold = (text: string) => text.replace(/[‘’]/gu, "'").replace(/[“”]/gu, '"');
          expect(fold(words.slice(match.from, match.to))).toBe(fold(match.words));
        }
      }),
    );
  });
});
