// A chapter's first line (#40), which a book sets apart (in capitals, when
// it's set as a book). It's no element of the publisher's but where a
// paragraph stands: the first one with words after the chapter's title.

import type { CleanElement, CleanNode } from '../html';

const hasWords = (node: CleanNode): boolean =>
  node.kind === 'text' ? node.text.trim() !== '' : node.children.some(hasWords);

/** `nodes`, the first paragraph after the chapter's title named `first-line`. */
export function markFirstLine(nodes: readonly CleanNode[]): CleanNode[] {
  let titled = false;
  let marked = false;
  const walk = (list: readonly CleanNode[]): CleanNode[] =>
    list.map((node) => {
      if (marked || node.kind === 'text') return node;
      if (node.part === 'chapter-title') {
        titled = true;
        return node;
      }
      if (titled && node.name === 'p' && !node.part && hasWords(node)) {
        marked = true;
        return { ...node, part: 'first-line' } satisfies CleanElement;
      }
      // An epigraph's or a caption's words are no chapter's first line.
      if (node.part) return node;
      return { ...node, children: walk(node.children) };
    });
  return walk(nodes);
}
