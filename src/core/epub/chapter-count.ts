// A chapter's words counted as a place counts them (#40, Phase 4), from its
// cleaned nodes by the one walk of them (./chapter-words.ts): how long it
// is, for steady page numbers, and where the printed edition's pages begin
// in it.

import type { CleanNode } from '../html';
import { walkChapter } from './chapter-words';

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
  walkChapter(nodes, {
    text: (text, counted) => {
      if (counted) length += text.length;
    },
    // The first marker of a name, as a link's place is found (ui/epub/book-links.ts markerIn).
    anchor: (name) => {
      if (names.has(name) && !anchors.has(name)) anchors.set(name, length);
    },
  });
  return { length, anchors };
}
