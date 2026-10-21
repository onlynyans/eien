// Footnotes, as GitHub and Obsidian write them: "[^label]" in the text, and
// "[^label]: The note." at a line's start, its later lines indented (or
// lazily carrying on its first paragraph). The editor shows them as written;
// a book's exports number them (spec §8).

import type { SyntaxNodeRef } from '@lezer/common';
import { eienParser } from './read';

/** A footnote's label as GitHub matches it: case aside. */
export const footnoteKey = (label: string): string => label.toLowerCase();

const DEFINITION = /^ {0,3}\[\^([^\]\s]+)\]:(?:[ \t]+|$)(.*)$/u;
const FENCE = /^ {0,3}(`{3,}|~{3,})/u;
/** A line that starts a block of its own, so it can't carry on a paragraph lazily. */
const BLOCK_START =
  /^ {0,3}(?:#{1,6}(?:[ \t]|$)|(?:[*_-][ \t]*){3,}$|>|[-+*][ \t]|\d{1,9}[.)][ \t]|`{3,}|~{3,}|<)/u;
const INDENTED = /^(?: {4}|\t)/u;

export interface FootnoteSplit {
  /** The text with each definition's lines left blank: what's around it stays where it was. */
  readonly text: string;
  /** Each label's Markdown (its later lines unindented), by key, in the order defined. */
  readonly notes: ReadonlyMap<string, string>;
}

/**
 * The footnotes defined in `text` (editor text: "\n" line ends, no front
 * matter), taken out of it. A label's first definition counts; a later one
 * is left in the text, as words. Nothing in fenced code is a definition.
 */
export function splitFootnotes(text: string): FootnoteSplit {
  const lines = text.split('\n');
  const notes = new Map<string, string>();
  let fence: string | null = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] as string;
    const opens = FENCE.exec(line)?.[1];
    if (fence) {
      if (opens && opens[0] === fence[0] && opens.length >= fence.length) fence = null;
      continue;
    }
    if (opens) {
      fence = opens;
      continue;
    }
    const definition = DEFINITION.exec(line);
    if (!definition) continue;
    const key = footnoteKey(definition[1] as string);
    if (notes.has(key)) continue;
    const body = [definition[2] as string];
    let end = i + 1;
    let lazy = true; // its first paragraph carries on until a blank line
    for (let next = i + 1; next < lines.length; next++) {
      const after = lines[next] as string;
      if (after.trim() === '') {
        lazy = false;
        continue;
      }
      if (INDENTED.test(after)) {
        body.push(...lines.slice(end, next).map(() => ''), after.replace(INDENTED, ''));
        lazy = true; // a paragraph of it, which the lines after carry on
      } else if (lazy && !DEFINITION.test(after) && !BLOCK_START.test(after)) {
        body.push(after);
      } else break;
      end = next + 1;
    }
    notes.set(key, body.join('\n').trim());
    for (let blank = i; blank < end; blank++) lines[blank] = '';
    i = end - 1;
  }
  return { text: lines.join('\n'), notes };
}

/** Where a "[^label]" can't be a footnote's mark: code, addresses, HTML tags, comments. */
const LITERAL = new Set([
  'InlineCode',
  'FencedCode',
  'CodeBlock',
  'URL',
  'Autolink',
  'HTMLTag',
  'Comment',
  'CommentBlock',
  'ProcessingInstruction',
  'ProcessingInstructionBlock',
]);

export interface FootnoteRef {
  readonly from: number;
  readonly to: number;
  readonly key: string;
}

/** Ranges of `text` where nothing is a mark: code, addresses, tags; and the tags in an HTML block. */
export function literalRanges(text: string): [number, number][] {
  const ranges: [number, number][] = [];
  eienParser.parse(text).iterate({
    enter(node: SyntaxNodeRef) {
      if (LITERAL.has(node.name)) {
        ranges.push([node.from, node.to]);
        return false;
      }
      if (node.name === 'HTMLBlock') {
        for (const tag of text.slice(node.from, node.to).matchAll(/<[^>]*>?/gu)) {
          const from = node.from + tag.index;
          ranges.push([from, from + tag[0].length]);
        }
        return false;
      }
      return undefined;
    },
  });
  return ranges;
}

/** Every "[^label]" in `text` that's a mark: not in code, a tag or an address, and not escaped. */
export function footnoteRefs(text: string): FootnoteRef[] {
  const literal = literalRanges(text);
  const inLiteral = (at: number) => literal.some(([from, to]) => at >= from && at < to);
  const refs: FootnoteRef[] = [];
  for (const match of text.matchAll(/\[\^([^\]\s]+)\]/gu)) {
    const at = match.index;
    const slashes = /\\*$/u.exec(text.slice(Math.max(0, at - 16), at))?.[0].length ?? 0;
    if (slashes % 2 === 1 || inLiteral(at)) continue;
    refs.push({ from: at, to: at + match[0].length, key: footnoteKey(match[1] as string) });
  }
  return refs;
}
