// A chapter's words counted as a place counts them (#40, Phase 4), from its
// cleaned nodes: how long it is, for steady page numbers, and where the
// printed edition's pages begin in it. The window counts the same words in
// what it draws (ui/epub/chapter-place.ts piecesOf): every text node that
// isn't blank, each cleaned one drawn as one; but a rule (`hr`), which the
// window draws as Eien's own break and never counts. A cleaned picture's
// words (its alt, when it won't be shown) are plain text, and count on both.

import type { CleanNode } from '../html';

export interface ChapterCount {
  /** Its words' length, as an offset in it counts them (./place.ts). */
  readonly length: number;
  /** Where each place asked for begins: the words before its marker; a name not there is left out. */
  readonly anchors: ReadonlyMap<string, number>;
}

/** The chapter `nodes` hold counted, with where each of `names` (the places a page-list names) begins. */
export function countChapter(
  nodes: readonly CleanNode[],
  names: ReadonlySet<string> = new Set(),
): ChapterCount {
  let length = 0;
  const anchors = new Map<string, number>();
  const walk = (list: readonly CleanNode[]) => {
    for (const node of list) {
      if (node.kind === 'text') {
        if (node.text.trim() !== '') length += node.text.length;
        continue;
      }
      if (node.name === 'hr') continue;
      const name = node.name === 'a' ? node.attrs.anchor : undefined;
      // The first marker of a name, as a link's place is found (ui/epub/book-links.ts markerIn).
      if (name !== undefined && names.has(name) && !anchors.has(name)) anchors.set(name, length);
      walk(node.children);
    }
  };
  walk(nodes);
  return { length, anchors };
}
