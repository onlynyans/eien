// Over generated HTML, hostile pieces among a story's: the story page is never
// handed an element it doesn't know, an attribute it doesn't keep, or an
// address it doesn't follow, and the words outside dropped elements stay.

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { type CleanNode, cleanHtml, KEPT, plainOf } from './clean';

const piece = fc.constantFrom(
  '<p>',
  '</p>',
  '<p align="center">',
  '<div style="text-align:justify;display:block">',
  '</div>',
  '<em>',
  '</em>',
  '<span style="font-weight:700">',
  '</span>',
  '<hr>',
  '<br/>',
  '<blockquote>',
  '</blockquote>',
  '<a href="https://archiveofourown.org/works/1">',
  '<a href="javascript:alert(1)">',
  '<a href=" jav&#x09;ascript:x()">',
  '<a href="data:text/html;base64,AA">',
  '<a onclick="x()" href="#n1">',
  '</a>',
  '<img src="https://i.example/x.png" alt="art" onerror="x()">',
  '<img src="//i.example/x.png">',
  '<script>',
  '</script>',
  '<style>',
  '</style>',
  '<iframe src="https://e.x">',
  '</iframe>',
  '<svg onload="x()">',
  '</svg>',
  '<form action="https://e.x">',
  '</form>',
  '<input value="v">',
  '<table><tr><td align="right">',
  '</td></tr></table>',
  '<!-- c -->',
  '<',
  '>',
  '&amp;',
  '&lt;script&gt;',
  'words',
  ' ',
  'Rook',
);

const html = fc.array(piece, { maxLength: 40 }).map((pieces) => pieces.join(''));

const ATTRS = new Set(['href', 'src', 'alt', 'title', 'align']);

function* elements(
  nodes: readonly CleanNode[],
): Generator<Extract<CleanNode, { kind: 'element' }>> {
  for (const node of nodes) {
    if (node.kind === 'element') {
      yield node;
      yield* elements(node.children);
    }
  }
}

describe('cleanHtml over generated HTML', () => {
  it('hands the story page only elements, attributes and addresses it keeps', () => {
    fc.assert(
      fc.property(html, (source) => {
        for (const element of elements(cleanHtml(source))) {
          expect(KEPT.has(element.name)).toBe(true);
          for (const name of Object.keys(element.attrs)) expect(ATTRS.has(name)).toBe(true);
          if (element.attrs.href !== undefined) {
            expect(element.attrs.href).toMatch(/^(?:https?:\/\/|mailto:)/iu);
          }
          if (element.name === 'img') expect(element.attrs.src).toMatch(/^https:\/\//u);
        }
      }),
    );
  });

  it('keeps the words that aren’t inside a dropped element', () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom('<p>', '</p>', '<em>', '</em>', '<hr>', 'Rook', ' '), {
          maxLength: 30,
        }),
        (pieces) => {
          const words = pieces.filter((p) => p === 'Rook').length;
          expect(plainOf(cleanHtml(pieces.join(''))).match(/Rook/gu)?.length ?? 0).toBe(words);
        },
      ),
    );
  });
});
