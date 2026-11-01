// The places in a page a link may name (#40, Phase 2b: a book's notes and
// its links between chapters), read before the page is tidied: tidying
// moves and drops elements (a span isn't kept; an inline element round
// blocks goes inside them), and an id would go with them. Each place the
// caller keeps becomes an empty `a` of its own where it stood, the first
// thing in a block that had it, just before anything else that did; the
// first of two the same, as a browser finds it. The element itself keeps
// no id: a page can't name the window's elements.

import type { HtmlElement, HtmlNode } from './html';
import { BLOCK } from './tidy';

/**
 * The attribute a marker carries its place in, read by the cleaner alone; a
 * page's own of that name is dropped here, so only a marker has one.
 */
export const ANCHOR = '\u0000anchor';

const marker = (place: string): HtmlElement => ({
  kind: 'element',
  name: 'a',
  attrs: { [ANCHOR]: place },
  children: [],
});

/** `nodes` with each place `keep` keeps marked by an empty `a`, and no element keeping its id. */
export function anchored(
  nodes: readonly HtmlNode[],
  keep: (id: string) => string | null,
): HtmlNode[] {
  const seen = new Set<string>();
  const placeOf = (node: HtmlElement): string | null => {
    const id = node.attrs.id ?? (node.name === 'a' ? node.attrs.name : undefined);
    const kept = id === undefined ? null : keep(id);
    if (kept === null || seen.has(kept)) return null;
    seen.add(kept);
    return kept;
  };
  const walk = (list: readonly HtmlNode[]): HtmlNode[] =>
    list.flatMap((node): HtmlNode[] => {
      if (node.kind === 'text') return [node];
      const place = placeOf(node);
      const { id: _id, [ANCHOR]: _own, ...attrs } = node.attrs;
      const children = walk(node.children);
      if (place === null) return [{ ...node, attrs, children }];
      // An old link that only names a place (Calibre's): the marker in its stead.
      if (node.name === 'a' && attrs.href === undefined && children.length === 0) {
        return [marker(place)];
      }
      if (BLOCK.has(node.name)) return [{ ...node, attrs, children: [marker(place), ...children] }];
      return [marker(place), { ...node, attrs, children }];
    });
  return walk(nodes);
}
