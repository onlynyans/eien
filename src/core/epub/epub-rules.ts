// What a book's chapter may show (#40), as the shared cleaner's rules
// (core/html/clean.ts). Its pictures come only from its own zip, in the
// formats a note's do; a link keeps its address when it lands on one of the
// book's own chapters (./book-link.ts, Phase 2b), or goes to the web or mail,
// which the system's browser opens as it does a note's (decided 2026-10-29);
// anything else keeps its words alone. The places a link may name are kept,
// and nothing on the page loads from outside the book. And
// its parts get names, read off the publisher's markup, for the book's
// stylesheet: a chapter's title, a scene break, an epigraph, a plate, a
// caption, a note and its reference.

import type { CleanRules, HtmlElement, HtmlNode } from '../html';
import { baseName } from '../paths';
import { imageTypeOf } from '../vault';
import { bookHref } from './book-link';
import { attr } from './xml-nodes';
import { inZip } from './zip-path';

const has = (node: HtmlElement, pattern: RegExp) =>
  pattern.test(attr(node, 'class')) || pattern.test(attr(node, 'type'));

const TITLE = /\bchapter[-_]?(?:title|head(?:ing)?)\b|(?:^|\s)title(?:\s|$)/iu;
const BREAK = /\b(?:scene|section|space)[-_]?break\b|\basterism\b|\btransition\b/iu;
const EPIGRAPH = /\bepigraph\b/iu;
const CAPTION = /\bcaption\b/iu;
/** A note's reference (EPUB 3's epub:type, DPUB-ARIA's role), and a note: foot, end or rear. */
const NOTE_REF = /\bnoteref\b/iu;
const NOTE = /\b(?:foot|end|rear)?note\b/iu;
/** A link the system's browser opens, as a note's: the web, or mail, and nothing else. */
const OUTSIDE = /^(?:https?:\/\/|mailto:)[^\s]+$/iu;
/** What a note may be: a block of words (an aside or a section is kept as a div), never its reference or a heading. */
const NOTE_BLOCKS: ReadonlySet<string> = new Set(['p', 'div', 'li', 'dd', 'blockquote']);
/** The longest place kept: an id is a name, not words. */
const MAX_ANCHOR = 256;

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

const roleIs = (node: HtmlElement, pattern: RegExp) => pattern.test(attr(node, 'role'));

function partOf(source: HtmlElement, name: string): string | null {
  if (name === 'a' && (has(source, NOTE_REF) || roleIs(source, /\bdoc-noteref\b/u))) {
    return 'note-ref';
  }
  if (NOTE_BLOCKS.has(name) && (has(source, NOTE) || roleIs(source, /\bdoc-(?:foot|end)note\b/u))) {
    return 'note';
  }
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

/** A place's name a link may give, kept: a name, not words or control characters. */
const placeName = (id: string): string | null =>
  id.length > 0 &&
  id.length <= MAX_ANCHOR &&
  ![...id].some((char) => char < ' ' || char === '\u007f')
    ? id
    : null;

/**
 * The rules for the chapter at `path` in a zip that holds `holds`, whose
 * spine `isChapter` names: a link keeps its address only to one of those.
 */
export function epubRules(
  path: string,
  holds: (name: string) => boolean,
  isChapter: (name: string) => boolean,
): CleanRules {
  return {
    link: (href) => {
      if (OUTSIDE.test(href.trim())) return href.trim();
      const at = inZip(path, href);
      return at && isChapter(at.path) ? bookHref(at) : null;
    },
    anchor: placeName,
    image: (src) => {
      const at = inZip(path, src);
      return at && holds(at.path) && imageTypeOf(baseName(at.path)) ? at.path : null;
    },
    part: partOf,
  };
}
