// What a book's chapter may show (#40), as the shared cleaner's rules
// (core/html/clean.ts). Its pictures come only from its own zip, in the
// formats a note's do; its links keep their words (the book's own links come
// with its place, later), so nothing on the page reaches outside the book.
// And its parts get names, read off the publisher's markup, for the book's
// stylesheet: a chapter's title, a scene break, an epigraph, a plate, a
// caption.

import type { CleanRules, HtmlElement, HtmlNode } from '../html';
import { baseName } from '../paths';
import { imageTypeOf } from '../vault';
import { attr } from './xml-nodes';
import { inZip } from './zip-path';

const has = (node: HtmlElement, pattern: RegExp) =>
  pattern.test(attr(node, 'class')) || pattern.test(attr(node, 'type'));

const TITLE = /\bchapter[-_]?(?:title|head(?:ing)?)\b|(?:^|\s)title(?:\s|$)/iu;
const BREAK = /\b(?:scene|section|space)[-_]?break\b|\basterism\b|\btransition\b/iu;
const EPIGRAPH = /\bepigraph\b/iu;
const CAPTION = /\bcaption\b/iu;

/** Whether an element holds a picture and nothing else: no words, one image, perhaps in a link or span. */
function onlyAPicture(node: HtmlElement): boolean {
  let images = 0;
  const walk = (nodes: readonly HtmlNode[]): boolean =>
    nodes.every((child) => {
      if (child.kind === 'text') return child.text.trim() === '';
      if (child.name === 'img') return ++images === 1;
      return walk(child.children);
    });
  return walk(node.children) && images === 1;
}

function partOf(source: HtmlElement, name: string): string | null {
  if (name === 'hr' || has(source, BREAK)) return 'scene-break';
  if (name === 'h1' || name === 'h2' || (name !== 'img' && has(source, TITLE))) {
    return 'chapter-title';
  }
  if (has(source, EPIGRAPH)) return 'epigraph';
  if (name === 'figcaption' || (name !== 'img' && has(source, CAPTION))) return 'caption';
  if (name === 'figure' || ((name === 'div' || name === 'p') && onlyAPicture(source))) {
    return 'plate';
  }
  return null;
}

/** The rules for the chapter at `path` in a zip that holds `holds`. */
export function epubRules(path: string, holds: (name: string) => boolean): CleanRules {
  return {
    link: () => null,
    image: (src) => {
      const at = inZip(path, src);
      return at && holds(at.path) && imageTypeOf(baseName(at.path)) ? at.path : null;
    },
    part: partOf,
  };
}
