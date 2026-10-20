// A note's text as words, the way the editor reads its Markdown: the marks
// taken out for previews and search, and a copy with code, links and HTML
// blanked out, where tags are looked for (spec §2).

import type { SyntaxNodeRef } from '@lezer/common';
import { Emoji, GFM, parser, Subscript, Superscript } from '@lezer/markdown';
import { Highlight, WikiLink } from './extensions';

/** The editor's Markdown (lang-markdown's GFM set) with Eien's two additions. */
export const eienParser = parser.configure([
  GFM,
  Subscript,
  Superscript,
  Emoji,
  Highlight,
  WikiLink,
]);

export interface ReadMarkdown {
  /** The words: marks, link addresses, images and HTML tags taken out; lines kept. */
  readonly plain: string;
  /** The text at its own positions, with code, links, URLs, HTML and marks as spaces. */
  readonly taggable: string;
}

/** Marks and machinery: never words, never tags. */
const MARKS = new Set([
  'HeaderMark',
  'EmphasisMark',
  'CodeMark',
  'CodeInfo',
  'LinkMark',
  'LinkLabel',
  'LinkTitle',
  'LinkReference', // "[1]: https://…", a link's address kept apart: not prose
  'QuoteMark',
  'ListMark',
  'TaskMarker',
  'StrikethroughMark',
  'SubscriptMark',
  'SuperscriptMark',
  'HighlightMark',
  'WikiLinkMark',
  'TableDelimiter',
  'HorizontalRule',
  'HTMLTag',
  'Comment',
  'CommentBlock',
  'ProcessingInstruction',
]);

/** Words, but not where a tag can be: code, links and addresses. */
const NO_TAGS = new Set([
  'InlineCode',
  'FencedCode',
  'CodeBlock',
  'Link',
  'WikiLink',
  'Autolink',
  'URL',
]);

/** Read `text` (editor text, front matter already taken off). */
export function readMarkdown(text: string): ReadMarkdown {
  const dropped: [number, number][] = [];
  const blanked: [number, number][] = [];
  const both = (from: number, to: number) => {
    dropped.push([from, to]);
    blanked.push([from, to]);
  };

  eienParser.parse(text).iterate({
    enter(node: SyntaxNodeRef) {
      const { name, from, to } = node;
      if (MARKS.has(name) || name === 'Image') {
        both(from, to);
        return false;
      }
      if (name === 'Escape') {
        dropped.push([from, from + 1]); // "\*" reads as "*"
        blanked.push([from, to]); // and "\#draft" is no tag
        return false;
      }
      if (name === 'URL') {
        // A link's address isn't its words; a bare address or <autolink> is.
        const parent = node.node.parent?.name;
        if (parent === 'Link' || parent === 'Image') dropped.push([from, to]);
        blanked.push([from, to]);
        return false;
      }
      if (name === 'HTMLBlock') {
        for (const tag of text.slice(from, to).matchAll(/<[^>]*>/g)) {
          dropped.push([from + tag.index, from + tag.index + tag[0].length]);
        }
        blanked.push([from, to]);
        return false;
      }
      if (NO_TAGS.has(name)) blanked.push([from, to]);
      return undefined;
    },
  });

  return { plain: without(text, dropped), taggable: blank(text, blanked) };
}

/** `text` without the ranges. */
function without(text: string, ranges: [number, number][]): string {
  ranges.sort((a, b) => a[0] - b[0]);
  let out = '';
  let at = 0;
  for (const [from, to] of ranges) {
    if (from > at) out += text.slice(at, from);
    at = Math.max(at, to);
  }
  return out + text.slice(at);
}

/** `text` with the ranges as spaces, so every other character keeps its place. */
function blank(text: string, ranges: [number, number][]): string {
  const chars = text.split(''); // UTF-16 units, as the parser counts
  for (const [from, to] of ranges) chars.fill(' ', from, to);
  return chars.join('');
}
