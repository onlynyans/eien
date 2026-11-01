// Find in a book (#40, Phase 5c): what's typed made a matcher, and every
// match in a chapter's blocks (./book-text.ts) as offsets in its words, with
// the words around it for a row. As a note's Find: the words as written,
// any case unless Match case, Whole word, and Pattern for a regular
// expression; written as words, curly and straight quotes are alike and any
// run of white space is a space, as a book's are. A match never runs across
// two blocks, and the count stops at the find bar's (core/find).

import { COUNT_LIMIT, escapePattern } from '../find';
import { type BookBlock, offsetIn } from './book-text';

/** How the words are matched: the find bar's three options. */
export interface FindOptions {
  readonly caseSensitive: boolean;
  readonly wholeWord: boolean;
  readonly regexp: boolean;
}

/** As the list's field finds: the words as written, any case. */
export const AS_WRITTEN: FindOptions = { caseSensitive: false, wholeWord: false, regexp: false };

/** How many characters of a match's block a row shows before it, and after: about a line's. */
export const CONTEXT = { before: 40, after: 64 } as const;

/** A match: where it is in the book, and its words with those round it, cut on whole words. */
export interface Found {
  readonly spine: number;
  readonly from: number;
  readonly to: number;
  readonly before: string;
  readonly words: string;
  readonly after: string;
}

/** Where a match stands in the book, for a walk between them: its chapter, and its first word. */
export const foundPlace = (match: Found): { readonly spine: number; readonly offset: number } => ({
  spine: match.spine,
  offset: match.from,
});

/** Quotes alike, written either way. */
const QUOTES: readonly (readonly [RegExp, string])[] = [
  [/['‘’]/gu, "['‘’]"],
  [/["“”]/gu, '["“”]'],
];

/** A letter, its marks or a figure: what a whole word is made of, in any script (as a tag's, ../tags). */
const WORD = '[\\p{L}\\p{M}\\p{N}_]';

/**
 * `query` as a matcher, by `options`; null for nothing to find, 'invalid'
 * for a pattern that can't be read.
 */
export function matcherOf(query: string, options: FindOptions): RegExp | 'invalid' | null {
  if (query.trim() === '') return null;
  let source = query;
  if (!options.regexp) {
    source = escapePattern(query.trim());
    for (const [quote, alike] of QUOTES) source = source.replace(quote, alike);
    source = source.replace(/\s+/gu, '\\s+');
  }
  if (options.wholeWord) source = `(?<!${WORD})(?:${source})(?!${WORD})`;
  try {
    return new RegExp(source, options.caseSensitive ? 'gu' : 'giu');
  } catch {
    return 'invalid';
  }
}

/** `text` cut to whole words at its start (`atStart`) or its end, an ellipsis where it was cut. */
function wholeWords(text: string, cut: boolean, atStart: boolean): string {
  if (!cut) return text;
  if (atStart) return `…${text.replace(/^\S*\s/u, '')}`;
  return `${text.replace(/\s\S*$/u, '')}…`;
}

/**
 * Every match `matcher` finds in spine item `spine`'s `blocks`, in order, up
 * to `room` of them. A match of nothing (a pattern's `^`) or of words the
 * chapter doesn't count (white space between blocks) is passed over.
 */
export function findIn(
  blocks: readonly BookBlock[],
  matcher: RegExp,
  spine: number,
  room = COUNT_LIMIT,
): Found[] {
  const found: Found[] = [];
  const pattern = new RegExp(matcher.source, matcher.flags);
  for (const block of blocks) {
    const { text } = block;
    pattern.lastIndex = 0;
    for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
      const start = match.index;
      const end = start + match[0].length;
      // Never stuck on a match of nothing: on past it.
      if (end === start) {
        pattern.lastIndex = start + 1;
        continue;
      }
      const from = offsetIn(block, start);
      const to = offsetIn(block, end);
      if (to <= from) continue;
      const before = Math.max(0, start - CONTEXT.before);
      const after = Math.min(text.length, end + CONTEXT.after);
      found.push({
        spine,
        from,
        to,
        before: wholeWords(text.slice(before, start), before > 0, true),
        words: match[0],
        after: wholeWords(text.slice(end, after), after < text.length, false),
      });
      if (found.length >= room) return found;
    }
  }
  return found;
}
