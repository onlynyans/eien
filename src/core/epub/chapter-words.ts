// A chapter's words, walked once from its cleaned nodes (#40), as a place
// counts them (./place.ts): every text node that isn't blank, each cleaned
// one drawn as one (ui/epub/chapter-place.ts piecesOf counts the same in
// what's drawn); never under a rule (`hr`), which the window draws as Eien's
// own break. A cleaned picture's words (its alt, when it won't be shown) are
// plain text, and count. The page count (./chapter-count.ts) and Find
// (Phase 5) both read the chapter through this walk, so their offsets can't
// drift apart.

import type { CleanElement, CleanNode } from '../html';

/**
 * What a word's block is: words in two of them read with a space between,
 * and Find never matches across two. Each an element the cleaner keeps
 * (its `section` and `aside` become a `div`). One list, for the window's
 * words too (ui/epub/chapter-place.ts).
 */
export const BLOCK_NAMES: readonly string[] = [
  'p',
  'div',
  'pre',
  'li',
  'dd',
  'dt',
  'blockquote',
  'td',
  'th',
  'figure',
  'figcaption',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
];

const BLOCKS: ReadonlySet<string> = new Set(BLOCK_NAMES);

/** What the walk meets, in the order the chapter reads. */
export interface ChapterVisit {
  /**
   * A text node: `counted` unless blank (its words have no offset, but read
   * between those that do), in `block`, its innermost block; null for none.
   */
  text?(text: string, counted: boolean, block: CleanElement | null): void;
  /** A line break, in `block`. */
  lineBreak?(block: CleanElement | null): void;
  /** A link's marker (a place a link may name, its `anchor`). */
  anchor?(name: string): void;
}

/** Walk the chapter `nodes` hold, word by word, telling `visit`. */
export function walkChapter(nodes: readonly CleanNode[], visit: ChapterVisit): void {
  const walk = (list: readonly CleanNode[], block: CleanElement | null) => {
    for (const node of list) {
      if (node.kind === 'text') {
        visit.text?.(node.text, node.text.trim() !== '', block);
        continue;
      }
      if (node.name === 'hr') continue;
      if (node.name === 'br') visit.lineBreak?.(block);
      const name = node.name === 'a' ? node.attrs.anchor : undefined;
      if (name !== undefined) visit.anchor?.(name);
      walk(node.children, BLOCKS.has(node.name) ? node : block);
    }
  };
  walk(nodes, null);
}
