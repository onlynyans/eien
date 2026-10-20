// Search (spec §4): every word of the query, anywhere in a note's title or
// words, with case, accents, curly quotes and full-width forms aside.

/** Characters folded to another, after case and accents. */
const MAP: Record<string, string> = {
  '‘': "'",
  '’': "'",
  '‚': "'",
  '‛': "'",
  '′': "'",
  '“': '"',
  '”': '"',
  '„': '"',
  '‟': '"',
  '″': '"',
  ß: 'ss',
  ς: 'σ', // a final sigma is a sigma
};
const MAPPED = new RegExp(`[${Object.keys(MAP).join('')}]`, 'g');

/**
 * Text as search compares it: "Café" is "cafe", "don’t" is "don't", "ＡＢ"
 * is "ab". Folding one character at a time gives the same length as the
 * whole text, which is how a match is traced back to where it was.
 */
export function fold(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(MAPPED, (char) => MAP[char] ?? char);
}

/** A search's answer: the best `hits`, of `total` notes that match. */
export interface SearchResult {
  readonly total: number;
  readonly hits: readonly { readonly path: string; readonly snippet: string }[];
}

/** What a note is searched by: its title and words, folded, whitespace as single spaces. */
export const searchText = (title: string, plain: string): string =>
  fold(`${title} ${plain}`.replace(/\s+/g, ' '));

/** The query's terms, folded: words, and "quoted phrases" kept whole. */
export function queryTerms(query: string): string[] {
  const terms: string[] = [];
  for (const match of fold(query).matchAll(/"([^"]*)"|(\S+)/g)) {
    const term = (match[1] ?? match[2] ?? '').replace(/\s+/g, ' ').trim();
    if (term) terms.push(term);
  }
  return terms;
}

/** Whether folded text holds every term. No terms match nothing. */
export const matchesAll = (folded: string, terms: readonly string[]): boolean =>
  terms.length > 0 && terms.every((term) => folded.includes(term));

/** How much a snippet shows before and after the first match, in characters. */
const BEFORE = 36;
const AFTER = 90;

/**
 * A line of `plain` around the first place a term matches, its whitespace
 * collapsed, cut at word boundaries with "…"; the start of the text when no
 * term is in it (the match was in the title).
 */
export function snippet(plain: string, terms: readonly string[]): string {
  const text = plain.replace(/\s+/g, ' ').trim();
  const at = firstMatch(text, terms);
  if (at < 0) return cut(text, 0, BEFORE + AFTER);
  return cut(text, Math.max(0, at - BEFORE), at + AFTER);
}

/** Where in `text` (original positions) the earliest term begins, or -1. */
function firstMatch(text: string, terms: readonly string[]): number {
  const folded = fold(text);
  const hits = terms.map((term) => folded.indexOf(term)).filter((at) => at >= 0);
  if (hits.length === 0) return -1;
  const target = Math.min(...hits);
  // Walk the original until its folded length reaches the hit: folding can change lengths.
  let length = 0;
  let index = 0;
  for (const char of text) {
    if (length >= target) return index;
    length += fold(char).length;
    index += char.length;
  }
  return index;
}

function cut(text: string, from: number, to: number): string {
  let start = from;
  let end = Math.min(text.length, to);
  if (start > 0) {
    const space = text.indexOf(' ', start);
    start = space >= 0 && space < end ? space + 1 : start;
  }
  if (end < text.length) {
    const space = text.lastIndexOf(' ', end);
    end = space > start ? space : end;
  }
  return `${start > 0 ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`;
}
