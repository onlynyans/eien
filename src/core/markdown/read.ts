// A note's text as words, the way the editor reads its Markdown: the marks
// taken out for previews and search, and a copy with code, links and HTML
// blanked out, where tags are looked for (spec §2).

import type { SyntaxNodeRef } from '@lezer/common';
import { Emoji, GFM, parser, Subscript, Superscript } from '@lezer/markdown';
import { Highlight, WikiLink } from './extensions';
import { isLink, referenceLabels } from './links';

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

/** How many lines a run without a blank line may have before it's read in pieces. */
const RUN_LINES = 64;

/**
 * `text` with a blank line every RUN_LINES lines of a run that has none
 * (fenced code aside). The parser's time grows with the square of the
 * brackets in one paragraph: a pasted transcript, one line per turn with
 * "[laughs]" in each, took seconds. Only whitespace is added, which the
 * words, previews and search all collapse; a mark that crosses one of these
 * cuts reads as text.
 */
export function inRuns(text: string): string {
  const lines = text.split('\n');
  if (lines.length <= RUN_LINES) return text;
  let run = 0;
  let fence: string | null = null;
  const out: string[] = [];
  for (const line of lines) {
    const opens = /^ {0,3}(`{3,}|~{3,})/.exec(line)?.[1];
    if (fence) {
      if (opens && opens[0] === fence[0] && opens.length >= fence.length) fence = null;
    } else if (opens) fence = opens;
    if (line.trim() === '') run = 0;
    else if (!fence && ++run > RUN_LINES) {
      out.push('');
      run = 1;
    }
    out.push(line);
  }
  return out.join('\n');
}

/** Read `text` (editor text, front matter already taken off). */
export function readMarkdown(source: string): ReadMarkdown {
  const text = inRuns(source);
  const dropped: [number, number][] = [];
  const blanked: [number, number][] = [];
  const both = (from: number, to: number) => {
    dropped.push([from, to]);
    blanked.push([from, to]);
  };

  const tree = eienParser.parse(text);
  const slice = (from: number, to: number) => text.slice(from, to);
  const references = referenceLabels(tree, slice);
  /** Where the brackets that aren't links start. */
  const notLinks = new Set<number>();
  tree.iterate({
    enter(node: SyntaxNodeRef) {
      const { name, from, to } = node;
      // "[sic]": the writer's brackets, not a link. Brackets and words are read as text.
      if ((name === 'Link' || name === 'Image') && !isLink(node.node, slice, references)) {
        notLinks.add(from);
        return undefined;
      }
      const parent = node.node.parent;
      if ((name === 'LinkMark' || name === 'LinkLabel') && parent && notLinks.has(parent.from)) {
        return false;
      }
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
