// Over generated chapters, hostile pieces among them, cleaned under a book's
// rules (#40, Phase 4): core's count of a chapter's words and of where each
// place begins (core/epub/chapter-count.ts) is what the window counts in
// what it draws (./chapter-place.ts), so a steady page number and a printed
// page's place are the same words the page shows.

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { hostileHtml } from '../../../tests/support/hostile-html';
import { countChapter } from '../../core/epub';
import { epubRules } from '../../core/epub/epub-rules';
import { type CleanNode, cleanHtml } from '../../core/html';
import { drawClean } from '../draw-clean';
import { markerIn } from './book-links';
import { offsetAfter, piecesOf } from './chapter-place';

/** Every place the cleaned nodes keep a marker for. */
function names(nodes: readonly CleanNode[], into = new Set<string>()): Set<string> {
  for (const node of nodes) {
    if (node.kind !== 'element') continue;
    if (node.name === 'a' && node.attrs.anchor !== undefined) into.add(node.attrs.anchor);
    names(node.children, into);
  }
  return into;
}

describe('a chapter’s count, over generated chapters', () => {
  it('is the window’s count of what it draws: its length, and where each place begins', () => {
    fc.assert(
      // Pictures in the zip or not: a picture it won't show is kept as its words.
      fc.property(hostileHtml, fc.boolean(), (source, holds) => {
        const nodes = cleanHtml(
          source,
          epubRules(
            'OEBPS/text/one.xhtml',
            () => holds,
            () => true,
          ),
        );
        const asked = names(nodes);
        const { length, anchors } = countChapter(nodes, asked);
        const chapter = document.createElement('div');
        chapter.append(drawClean(nodes));
        expect(length).toBe(piecesOf(chapter).reduce((sum, text) => sum + text.length, 0));
        for (const name of asked) {
          const marker = markerIn(chapter, name);
          expect(marker).not.toBeNull();
          if (marker) expect(anchors.get(name)).toBe(offsetAfter(chapter, marker));
        }
      }),
    );
  });
});
