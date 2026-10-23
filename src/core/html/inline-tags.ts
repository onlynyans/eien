// What Copy as HTML's inline writer (./inline-writer.ts) knows of a note's
// marks and tags: the HTML a note may hold that story sites take, the parser's
// nodes that are only marks, and those that hold words in a tag story sites take.

/** Inline HTML a note may hold (spec §4) that story sites take as it is. */
export const INLINE_TAGS = new Set([
  'u',
  'em',
  'i',
  'strong',
  'b',
  's',
  'del',
  'ins',
  'sup',
  'sub',
  'br',
  'small',
  'big',
  'cite',
  'q',
]);

/** The parser's nodes that hold words in a tag story sites take. */
export const INLINE_CONTAINERS: Readonly<Record<string, string>> = {
  Emphasis: 'em',
  StrongEmphasis: 'strong',
  Strikethrough: 's',
  Subscript: 'sub',
  Superscript: 'sup',
};

/** The parser's nodes that are only marks: never words. */
export const MARKS = new Set([
  'EmphasisMark',
  'StrikethroughMark',
  'SubscriptMark',
  'SuperscriptMark',
  'HighlightMark',
  'QuoteMark',
  'HeaderMark',
  'ListMark',
  'LinkMark',
  'WikiLinkMark',
  'CodeMark',
  'CodeInfo',
  'LinkTitle',
  'LinkLabel',
  'TableDelimiter',
]);

/** The note's own tags that start a line or a paragraph. */
export const BREAKS = new Set(['br', 'hr', 'p', 'div', 'blockquote']);
