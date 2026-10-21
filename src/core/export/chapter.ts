// A note as a chapter of an export (spec §8): its heading, its blocks of
// HTML as Copy for AO3 writes them for a book (core/ao3's bookBlocks), and
// its footnotes, numbered in the order they're first referred to. EPUB,
// Word and the PDF are each made from this.

import { bookBlocks, decodeEntities, escapeHtml } from '../ao3';
import { footnoteRefs, inRuns, literalRanges, splitFootnotes } from '../markdown';
import { frontMatterEnd, toEditor } from '../text';
import type { QuoteStyle } from '../typography';
import { xmlChars } from './xml';

/** A note to export: its title (the file's name) and its text as stored. */
export interface ExportNote {
  readonly title: string;
  readonly markdown: string;
}

export interface Chapter {
  /** The heading, as inline HTML. */
  readonly heading: string;
  /** The heading as words, for a contents page, a bookmark, a file's title. */
  readonly headingText: string;
  /** Its blocks of HTML; a footnote's mark links to the note (`#<ids>fn<n>`). */
  readonly blocks: readonly string[];
  /** Its footnotes, numbered from 1. */
  readonly notes: readonly Footnote[];
}

export interface Footnote {
  readonly blocks: readonly string[];
  /**
   * Whether a mark leads to it from the chapter's text, or from a note that
   * is: then its first mark has the id `<ids>fnref<n>`. One that isn't (no
   * mark, or marks only in notes nothing leads to) is shown in the text's flow.
   */
  readonly referred: boolean;
}

/**
 * A footnote's mark while the Markdown is written as HTML: a character
 * reference to a private-use character, U+F0000 and on, which the writer
 * keeps as it is and the parser reads as one character, as it would "]".
 * Written with six hex digits, a spelling a note's own reference is moved
 * off (to decimal) before the marks go in.
 */
const MARK = /&#x0F([0-9A-F]{4});/gu;
const markOf = (n: number) => `&#x0F${n.toString(16).toUpperCase().padStart(4, '0')};`;
/** The most marks: the private-use characters up to U+FFFFD. */
const MOST_NOTES = 0xfffd;

/** The words of inline HTML: tags and footnote marks out, entities read, spaces as one. */
export const wordsOf = (html: string): string =>
  decodeEntities(html.replace(MARK, '').replace(/<[^>]*>/gu, ''))
    .replace(/\s+/gu, ' ')
    .trim();

/** `text` with its "[^label]" marks for the notes `number` knows as MARKs, and nothing else changed. */
function withMarks(text: string, number: (key: string) => number | null): string {
  if (!/\[\^|&#x0f/iu.test(text)) return text; // nothing to mark: no parse
  const literal = literalRanges(text);
  const edits: { from: number; to: number; with: string }[] = [];
  for (const own of text.matchAll(/&#x0f([0-9a-f]{4});/giu)) {
    const at = own.index;
    if (literal.some(([from, to]) => at >= from && at < to)) continue;
    edits.push({
      from: at,
      to: at + own[0].length,
      with: `&#${0xf0000 + Number.parseInt(own[1] as string, 16)};`,
    });
  }
  for (const ref of footnoteRefs(text, literal)) {
    const n = number(ref.key);
    if (n !== null) edits.push({ from: ref.from, to: ref.to, with: markOf(n) });
  }
  edits.sort((a, b) => b.from - a.from);
  let out = text;
  for (const edit of edits) out = out.slice(0, edit.from) + edit.with + out.slice(edit.to);
  return out;
}

/**
 * A footnote's Markdown, its first line as the page shows it after "[^1]: ":
 * words, never a block of its own (a heading, a list, code, an HTML block).
 */
const asWords = (markdown: string): string =>
  markdown.replace(/^(?:[#>+*\-=_|<`~]|\d{1,9}(?=[.)]))/u, (start) =>
    /^\d/u.test(start) ? `${start}\\` : `\\${start}`,
  );

/** A link's words may hold no link: a mark among them goes just after it. */
function marksAfterLinks(html: string, mark: (hex: string) => string): string {
  let out = '';
  let held = '';
  let depth = 0;
  for (const part of html.split(/(<a\b[^>]*>|<\/a>|&#x0F[0-9A-F]{4};)/u)) {
    const hex = /^&#x0F([0-9A-F]{4});$/u.exec(part)?.[1];
    if (hex !== undefined) {
      if (depth > 0) held += mark(hex);
      else out += mark(hex);
      continue;
    }
    out += part;
    if (part.startsWith('<a')) depth++;
    else if (part === '</a>' && --depth === 0) {
      out += held;
      held = '';
    }
  }
  return out + held;
}

/**
 * The note's text (front matter left out) as a chapter; `ids` begins its
 * footnotes' ids. A paragraph of more than 64 lines goes as paragraphs of
 * 64, as the index reads it (spec §4): the parser takes seconds over one.
 */
export function chapterOf(note: ExportNote, quotes: QuoteStyle, ids = ''): Chapter {
  const text = toEditor(note.markdown);
  const split = splitFootnotes(text.slice(frontMatterEnd(text)));
  const body = inRuns(split.text);
  const defined = new Map([...split.notes].map(([key, md]) => [key, inRuns(asWords(md))]));
  const order: string[] = [];
  const numbers = new Map<string, number>();
  const number = (key: string): number | null => {
    if (!defined.has(key)) return null; // "[^x]" with no note: shown as written
    const known = numbers.get(key);
    if (known !== undefined) return known;
    if (order.length >= MOST_NOTES) return null;
    order.push(key);
    numbers.set(key, order.length);
    return order.length;
  };
  const marked = new Set<number>();
  const link = (html: string) =>
    marksAfterLinks(html, (hex) => {
      const n = Number.parseInt(hex, 16);
      // The first mark of a note is the one its number links back to.
      const id = marked.has(n) ? '' : ` id="${ids}fnref${n}"`;
      marked.add(n);
      return `<sup><a class="noteref" epub:type="noteref"${id} href="#${ids}fn${n}">${n}</a></sup>`;
    });
  const blocks = bookBlocks(withMarks(body, number), quotes);
  // The notes' own Markdown may refer to further notes; a note never referred to comes last.
  const notes: string[][] = [];
  for (let i = 0; ; i++) {
    if (i === order.length) {
      const next = [...defined.keys()].find((key) => !numbers.has(key));
      if (next === undefined || number(next) === null) break;
    }
    notes.push(bookBlocks(withMarks(defined.get(order[i] as string) ?? '', number), quotes));
  }
  // A note is referred to when a mark leads to it from the text, or from a note that is.
  const marksIn = (html: readonly string[]) =>
    [...html.join('').matchAll(MARK)].map((match) => Number.parseInt(match[1] as string, 16));
  const referred = new Set<number>();
  const reach = (n: number) => {
    if (referred.has(n)) return;
    referred.add(n);
    for (const next of marksIn(notes[n - 1] ?? [])) reach(next);
  };
  for (const n of marksIn(blocks)) reach(n);
  const [first, ...rest] = blocks;
  // A note that begins with a top-level heading ("# …", written as <h2>) is headed by it, not twice.
  const found = first !== undefined ? /^<h2>([\s\S]*)<\/h2>$/u.exec(first)?.[1] : undefined;
  // One with no words a file can hold ("# &#1;") heads nothing: the title does.
  const own = found !== undefined && xmlChars(wordsOf(found)) !== '' ? found : undefined;
  const heading = own ?? escapeHtml(note.title);
  const linked = {
    heading: link(heading),
    headingText: xmlChars(wordsOf(heading)) || note.title,
    blocks: (own === undefined ? blocks : rest).map(link),
    notes: notes.map((note) => note.map(link)),
  };
  return {
    ...linked,
    notes: linked.notes.map((blocks, i) => ({ blocks, referred: referred.has(i + 1) })),
  };
}
