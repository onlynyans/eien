// A book's highlights (#40, Phase 5a), in its reading state's file
// (./reading.ts): `"highlights": [{ "chapter", "from", "to", "words" }]`,
// each a run of a chapter's words by their offsets (./place.ts), so it holds
// through a new width, face, size, view or device, with the words it holds,
// for the list. Kept as every list in the file is (./reading-list.ts). What
// H does to them is decided here, against the list as the file holds it.

import { BOOKMARK_WORDS, MAX_BOOKMARKS } from './bookmarks';
import { type ListChange, type ListKind, listIn, withList } from './reading-list';

/** A run of a chapter's words. */
export interface Span {
  /** Its first word's offset in the chapter. */
  readonly from: number;
  /** Where it ends: the offset just past its last character. */
  readonly to: number;
}

export interface Highlight extends Span {
  /** The chapter's file in the zip. */
  readonly chapter: string;
  /** The words it holds, as the list shows them. */
  readonly words: string;
}

/** The most a book's list shows, as of its bookmarks: a file with more is kept whole. */
export const MAX_HIGHLIGHTS = MAX_BOOKMARKS;

/** The most of its words a highlight keeps: what a row of Marks shows, as a bookmark keeps. */
export const HIGHLIGHT_WORDS = BOOKMARK_WORDS;

const isOffset = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;

/** A highlight from the file, or null for an item this Eien can't read. */
function highlightOf(item: unknown): Highlight | null {
  if (typeof item !== 'object' || item === null) return null;
  const { chapter, from, to, words } = item as Record<string, unknown>;
  if (typeof chapter !== 'string' || chapter === '') return null;
  if (!isOffset(from) || !isOffset(to) || from >= to) return null;
  return {
    chapter,
    from,
    to,
    // Another Eien's longer words are cut as this one shows them, never kept whole in memory.
    words: typeof words === 'string' ? words.slice(0, HIGHLIGHT_WORDS * 2) : '',
  };
}

/** Whether two highlights are one: the same chapter and words. */
export const sameHighlight = (
  a: Pick<Highlight, 'chapter' | 'from' | 'to'>,
  b: Pick<Highlight, 'chapter' | 'from' | 'to'>,
): boolean => a.chapter === b.chapter && a.from === b.from && a.to === b.to;

/** How the file keeps highlights. */
const HIGHLIGHTS: ListKind<Highlight> = {
  field: 'highlights',
  read: highlightOf,
  same: sameHighlight,
};

/** The highlights the file's text holds that this Eien can read, the first MAX_HIGHLIGHTS of them. */
export const highlightsOf = (text: string | null): Highlight[] =>
  listIn(text, HIGHLIGHTS, MAX_HIGHLIGHTS);

/** The file's text with `change` made to its highlights; null when the file can't be written. */
export const withHighlights = (text: string | null, change: ListChange<Highlight>): string | null =>
  withList(text, HIGHLIGHTS, change);

/** The highlights in `chapter`. */
export const highlightsIn = (list: readonly Highlight[], chapter: string): Highlight[] =>
  list.filter((each) => each.chapter === chapter);

/**
 * What H does with the words `span` in `chapter`: inside one highlight, that
 * one taken off (`off`); else one highlight over them and every highlight in
 * the chapter they overlap or touch (`span`, the union), those taken off, so
 * H never leaves two that overlap.
 */
export type HighlightChange =
  | { readonly off: Highlight }
  | { readonly span: Span; readonly remove: readonly Highlight[] };

export function highlightChange(
  list: readonly Highlight[],
  chapter: string,
  span: Span,
): HighlightChange {
  const mine = highlightsIn(list, chapter);
  const holding = mine.find((each) => each.from <= span.from && span.to <= each.to);
  if (holding) return { off: holding };
  const remove = mine.filter((each) => each.from <= span.to && span.from <= each.to);
  return {
    span: {
      from: Math.min(span.from, ...remove.map((each) => each.from)),
      to: Math.max(span.to, ...remove.map((each) => each.to)),
    },
    remove,
  };
}
