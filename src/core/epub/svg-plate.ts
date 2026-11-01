// Calibre's way with a cover or a plate (#40): the picture in an <svg> frame,
// `<svg viewBox…><image xlink:href="plate.jpg"/></svg>`, so it scales to the
// page. The cleaner drops every <svg> (core/html/clean-elements.ts); this
// pass, before it, turns a frame round one picture into a plain <img>, which
// the book's rules then check as any other. Any other SVG stays dropped.

import type { HtmlElement, HtmlNode } from '../html';
import { all, attr, local } from './xml-nodes';

/** The picture an SVG frames, as an <img>; null for an SVG that's a drawing. */
function unwrapped(svg: HtmlElement): HtmlElement | null {
  const images = all(svg.children, 'image');
  if (images.length !== 1) return null;
  const src = attr(images[0] as HtmlElement, 'href');
  if (!src) return null;
  return {
    kind: 'element',
    name: 'img',
    attrs: { src, alt: attr(svg, 'aria-label') },
    children: [],
  };
}

/** `nodes`, each SVG frame round one picture made a plain image. */
export function unwrapSvgPlates(nodes: readonly HtmlNode[]): HtmlNode[] {
  return nodes.map((node) => {
    if (node.kind !== 'element') return node;
    if (local(node.name) === 'svg') return unwrapped(node) ?? node;
    return { ...node, children: unwrapSvgPlates(node.children) };
  });
}
