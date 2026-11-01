// Over generated chapters, hostile pieces among them, cleaned under a book's
// rules and drawn (#40, Phase 5a): a highlight's offsets are the words core
// counts at them (core/epub/chapter-words.ts, the walk the page count and
// Find read), so a highlight kept on one device, at one width, holds the
// same words on any other. Offsets to the drawn words and back are the same
// offsets; the words between them are core's, piece for piece, and as the
// list shows them (a space between two blocks); a boundary on an element, the
// characters before it.

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { hostileHtml } from '../../../tests/support/hostile-html';
import { type Span, walkChapter } from '../../core/epub';
import { epubRules } from '../../core/epub/epub-rules';
import { type CleanElement, type CleanNode, cleanHtml } from '../../core/html';
import { drawClean } from '../draw-clean';
import { wordsBetween } from './chapter-place';
import { boundsOf, offsetAt, rangeOver, spanOf, walked } from './chapter-range';

/** Core's counted words, and each counted text's block, in the order they read. */
function coreWords(nodes: readonly CleanNode[]) {
  const texts: { readonly text: string; readonly block: CleanElement | null }[] = [];
  walkChapter(nodes, {
    text: (text, counted, block) => {
      if (counted) texts.push({ text, block });
    },
  });
  return texts;
}

/** Core's words from `from` to `to`, a space between those of two blocks, as the window joins them. */
function coreBetween(texts: ReturnType<typeof coreWords>, { from, to }: Span): string {
  let words = '';
  let block: CleanElement | null | undefined;
  let at = 0;
  for (const { text, block: own } of texts) {
    const part = text.slice(Math.max(0, from - at), Math.max(0, to - at));
    at += text.length;
    if (part === '') {
      if (at >= to) break;
      continue;
    }
    if (words !== '' && own !== block) words += ' ';
    block = own;
    words += part;
  }
  return words;
}

/** A chapter as a book's prose is: blocks of words, runs of them in inline elements, a break or two. */
const proseHtml: fc.Arbitrary<string> = (() => {
  const run = fc.oneof(
    fc.constantFrom('It is a truth ', 'universally', ' acknowledged, ', 'Rook', ' ', 'İ'),
    fc
      .constantFrom('<em>', '<strong>', '<span class="smallcaps">', '<a href="#n1">')
      .chain((open) =>
        fc
          .constantFrom('a wife', 'Netherfield', 'Mr. Bennet', '  ')
          .map((words) => `${open}${words}</${open.slice(1).split(/[ >]/u)[0]}>`),
      ),
    fc.constant('<br/>'),
  );
  const block = fc
    .tuple(
      fc.constantFrom(
        ['<p>', '</p>'],
        ['<h2>', '</h2>'],
        ['<blockquote><p>', '</p></blockquote>'],
        ['<ul><li>', '</li></ul>'],
        ['<table><tr><td>', '</td></tr></table>'],
        ['<div>', '</div>'],
      ),
      fc.array(run, { minLength: 1, maxLength: 6 }),
    )
    .map(([[open, close], runs]) => `${open}${runs.join('')}${close}`);
  return fc
    .array(fc.oneof({ weight: 6, arbitrary: block }, fc.constant('\n<hr/>\n')), {
      maxLength: 8,
    })
    .map((blocks) => blocks.join('\n'));
})();

/** A chapter's nodes and the span to try in it: hostile pieces, or prose. */
const chapterAndSpan = fc
  .tuple(fc.oneof(hostileHtml, proseHtml), fc.boolean())
  .chain(([source, holds]) => {
    const nodes = cleanHtml(
      source,
      epubRules(
        'OEBPS/text/one.xhtml',
        () => holds,
        () => true,
      ),
    );
    const length = coreWords(nodes).reduce((sum, { text }) => sum + text.length, 0);
    return fc
      .tuple(fc.nat({ max: Math.max(0, length) }), fc.nat({ max: Math.max(0, length) }))
      .map(([a, b]) => ({ nodes, length, span: { from: Math.min(a, b), to: Math.max(a, b) } }));
  });

const drawn = (nodes: readonly CleanNode[]): HTMLElement => {
  const chapter = document.createElement('div');
  chapter.append(drawClean(nodes));
  return chapter;
};

describe('a highlight’s words, over generated chapters', () => {
  it('chosen on the page from its offsets, are its offsets again', () => {
    fc.assert(
      fc.property(chapterAndSpan, ({ nodes, span }) => {
        const chapter = drawn(nodes);
        const bounds = boundsOf(walked(chapter), span);
        if (span.from === span.to) {
          expect(bounds).toBeNull();
          return;
        }
        expect(bounds).not.toBeNull();
        if (!bounds) return;
        expect(spanOf(chapter, rangeOver(bounds))).toEqual(span);
        // Within its first and last characters' pieces: never at the end of the piece before, nor
        // at the start of the next, so a highlight ending a paragraph never ticks the next.
        expect(bounds.startOffset).toBeLessThan(bounds.startContainer.length);
        expect(bounds.endOffset).toBeGreaterThan(0);
      }),
    );
  });

  it('at a boundary between elements, are the book’s characters before it', () => {
    fc.assert(
      fc.property(chapterAndSpan, fc.nat(), fc.nat(), ({ nodes }, pick, child) => {
        const chapter = drawn(nodes);
        const elements = [chapter, ...chapter.querySelectorAll('*')];
        const node = elements[pick % elements.length] as Element;
        const at = child % (node.childNodes.length + 1);
        const next = node.childNodes[at];
        // A piece before the boundary: before the child it stands at, or inside the element before
        // its end, or (past every child) before the element's end.
        const before = (piece: Text) =>
          next
            ? Boolean(next.compareDocumentPosition(piece) & Node.DOCUMENT_POSITION_PRECEDING) &&
              !next.contains(piece)
            : Boolean(node.compareDocumentPosition(piece) & Node.DOCUMENT_POSITION_PRECEDING) ||
              node.contains(piece);
        const counted = walked(chapter)
          .pieces.filter(before)
          .reduce((sum, piece) => sum + piece.length, 0);
        expect(offsetAt(chapter, node, at)).toBe(counted);
      }),
    );
  });

  it('are core’s words at its offsets, piece for piece', () => {
    fc.assert(
      fc.property(chapterAndSpan, ({ nodes, span }) => {
        const chapter = drawn(nodes);
        const walk = walked(chapter);
        const bounds = boundsOf(walk, span);
        if (!bounds) return;
        const first = walk.pieces.indexOf(bounds.startContainer);
        const last = walk.pieces.indexOf(bounds.endContainer);
        const shown = walk.pieces
          .slice(first, last + 1)
          .map((piece, i, all) =>
            piece.data.slice(
              i === 0 ? bounds.startOffset : 0,
              i === all.length - 1 ? bounds.endOffset : piece.length,
            ),
          )
          .join('');
        const counted = coreWords(nodes)
          .map(({ text }) => text)
          .join('');
        expect(shown).toBe(counted.slice(span.from, span.to));
      }),
    );
  });

  it('as the list keeps them, are core’s, a space between two blocks', () => {
    fc.assert(
      fc.property(chapterAndSpan, ({ nodes, span }) => {
        const chapter = drawn(nodes);
        // No cap on how many: every one of them, to set beside core's.
        expect(wordsBetween(chapter, span.from, span.to, Number.POSITIVE_INFINITY)).toBe(
          coreBetween(coreWords(nodes), span),
        );
      }),
    );
  });
});
