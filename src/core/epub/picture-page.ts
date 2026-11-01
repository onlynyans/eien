// A chapter that's only a picture (#40, epub.md → Paged: a page of its own,
// fitted within the margins). What a publisher sets round it for room, an
// empty paragraph or a line break (a light novel's `<p>&nbsp;</p>` over
// Calibre's frame), would stand above a picture sized to the page and push
// it onto the next, leaving a blank page before it (#59). With no words in
// the chapter, that goes; its pictures stay, and every place a link names.

import type { CleanNode } from '../html';

const hasWords = (nodes: readonly CleanNode[]): boolean =>
  nodes.some((node) => (node.kind === 'text' ? node.text.trim() !== '' : hasWords(node.children)));

/** Whether `node` holds a picture or a place a link names, itself or within. */
const kept = (node: CleanNode): boolean =>
  node.kind === 'element' &&
  (node.name === 'img' || node.attrs.anchor !== undefined || node.children.some(kept));

const pictures = (nodes: readonly CleanNode[]): CleanNode[] =>
  nodes
    .filter(kept)
    .map((node) =>
      node.kind === 'element' && node.name !== 'img'
        ? { ...node, children: pictures(node.children) }
        : node,
    );

/** `nodes`, or with no words among them, only their pictures and the places links name. */
export const picturePage = (nodes: readonly CleanNode[]): readonly CleanNode[] =>
  hasWords(nodes) || !nodes.some(kept) ? nodes : pictures(nodes);
