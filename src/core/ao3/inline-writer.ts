// Copy for AO3, inline: a block's words, marks and the note's own HTML as
// AO3 takes them. Quotes follow the vault's setting; code keeps its own.
// ./to-html.ts writes the blocks round them. A book's exports (EPUB, Word,
// PDF; spec §8) differ only where AO3 has no tag or no place: a highlight
// is <mark>, an image its words, and a link goes to the web or mail only.

import type { SyntaxNode } from '@lezer/common';
import { CONTEXT, curlyQuotes, type QuoteStyle, straightQuotes } from '../typography';
import { bareAddress, destination, type References, safeAddress, webAddress } from './addresses';
import { decodeEntities, escapeAttr, escapeHtml, trimSpaces, visible } from './html';

/** Inline HTML a note may hold (spec §4) that AO3 takes as it is. */
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

/**
 * Lines of a block's HTML (parted by line breaks) without the ones that show
 * nothing (a line of only a note's own tags): their tags join the line before.
 */
function shownLines(html: string): string {
  const lines: string[] = [];
  for (const line of html.split(/<br \/>\n?/u)) {
    if (lines.length > 0 && !visible(line)) lines[lines.length - 1] += trimSpaces(line);
    else lines.push(line);
  }
  if (lines.length > 1 && !visible(lines[0] as string)) {
    lines[1] = trimSpaces(lines[0] as string) + lines[1];
    lines.shift();
  }
  return lines.join('<br />\n');
}

const INLINE_CONTAINERS: Readonly<Record<string, string>> = {
  Emphasis: 'em',
  StrongEmphasis: 'strong',
  Strikethrough: 's',
  Subscript: 'sub',
  Superscript: 'sup',
};

const MARKS = new Set([
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
const BREAKS = new Set(['br', 'hr', 'p', 'div', 'blockquote']);

export class InlineWriter {
  readonly #source: string;
  readonly #quotes: QuoteStyle;
  readonly #references: References;
  /** Written for a book's exports, not for AO3 (see the top of this file). */
  readonly #book: boolean;
  /** The last character of text written: what a quote after it opens or closes by. */
  #before = '';
  /** The note's own HTML tags opened in this block and not yet closed. */
  #open: { readonly name: string; readonly silent: boolean }[] = [];
  /** Tags open now (the note's own, and those of its marks): one already open isn't opened again. */
  readonly #active = new Map<string, number>();
  /** How many of them were opened outside the element being written: those it can't close. */
  #floor = 0;

  constructor(source: string, quotes: QuoteStyle, references: References, book = false) {
    this.#source = source;
    this.#quotes = quotes;
    this.#references = references;
    this.#book = book;
  }

  /** Whether a link to `href` is kept: one AO3 may follow; in a book, only to the web or mail. */
  #follows(href: string): boolean {
    return this.#book ? webAddress(href) : safeAddress(href);
  }

  /** Words, escaped, their quotes as the setting asks. */
  text(raw: string): string {
    if (!raw) return '';
    const quoted = this.#quotes === 'curly' ? curlyQuotes(raw, this.#before) : straightQuotes(raw);
    this.#before = (this.#before + quoted).slice(-CONTEXT);
    return escapeHtml(quoted);
  }

  /** A new block, line or cell: a quote at its start opens, whatever ended the one before. */
  startLine(): void {
    this.#before = '';
  }

  /** A run of words between nodes: its lines joined by line breaks, indentation and quote marks aside. */
  gap(raw: string): string {
    return raw
      .split('\n')
      .map((line, i) => {
        if (i === 0) return this.text(line);
        this.startLine();
        return this.text(line.replace(/^[ \t]*(?:>[ \t]?)*[ \t]*/u, ''));
      })
      .join('<br />\n');
  }

  /** An entity, kept as written: the character it shows decides a quote after it ("&nbsp;"…). */
  entity(raw: string): string {
    this.#before = (this.#before + decodeEntities(raw)).slice(-CONTEXT);
    return raw;
  }

  slice(from: number, to: number): string {
    return this.#source.slice(from, to);
  }

  /** Where the line holding `pos` starts. */
  lineStart(pos: number): number {
    return this.#source.lastIndexOf('\n', pos - 1) + 1;
  }

  /** A node's inline content, from `from` to `to` within it (its marks left out). */
  inline(node: SyntaxNode, from = node.from, to = node.to): string {
    let out = '';
    let at = from;
    for (let child = node.firstChild; child; child = child.nextSibling) {
      if (child.to <= from || child.from >= to) continue;
      out += this.gap(this.slice(at, child.from));
      out += this.inlineNode(child);
      at = child.to;
      // The space after a quote mark, a list mark or a checkbox isn't the writer's.
      const marks = ['QuoteMark', 'ListMark', 'TaskMarker'].includes(child.name);
      if (marks && this.slice(at, at + 1) === ' ') at++;
    }
    return out + this.gap(this.slice(at, to));
  }

  inlineNode(node: SyntaxNode): string {
    const name = node.name;
    if (MARKS.has(name)) return '';
    const tag = INLINE_CONTAINERS[name] ?? (this.#book && name === 'Highlight' ? 'mark' : null);
    if (tag) {
      // Italic inside italic is italic once.
      const nested = (this.#active.get(tag) ?? 0) > 0;
      this.#count(tag, 1);
      // The note's own HTML opened inside closes inside: elements nest, never overlap.
      const depth = this.#open.length;
      const floor = this.#floor;
      this.#floor = depth;
      const inner = this.inline(node);
      this.#floor = floor;
      const left = this.#closeFrom(depth);
      this.#count(tag, -1);
      return nested ? inner + left : `<${tag}>${inner}${left}</${tag}>`;
    }
    switch (name) {
      case 'HardBreak':
        this.startLine();
        return '<br />\n';
      case 'Escape':
        return this.text(this.slice(node.from + 1, node.to));
      case 'Entity':
        return this.entity(this.slice(node.from, node.to));
      case 'InlineCode': {
        const marks = node.getChildren('CodeMark');
        const inner = this.slice(marks[0]?.to ?? node.from, marks[1]?.from ?? node.to);
        if (!inner.trim()) return inner ? ' ' : ''; // code of nothing but space is a space
        this.#before = inner.slice(-1);
        return `<code>${escapeHtml(inner)}</code>`;
      }
      case 'Highlight':
        return this.inline(node);
      case 'WikiLink': {
        const inner = this.slice(node.from + 2, node.to - 2);
        const bar = inner.indexOf('|');
        return this.text(bar >= 0 ? inner.slice(bar + 1) : inner);
      }
      case 'Link':
      case 'Image':
        return this.link(node);
      case 'URL': {
        const url = this.slice(node.from, node.to).replace(/^<|>$/g, '');
        const href = bareAddress(url);
        return this.#follows(href)
          ? `<a href="${escapeAttr(href)}">${this.text(url)}</a>`
          : this.text(url);
      }
      case 'HTMLTag':
        return this.html(this.slice(node.from, node.to), INLINE_TAGS);
      case 'Comment':
      case 'ProcessingInstruction':
        return '';
      case 'TaskMarker':
        return this.text(/x/i.test(this.slice(node.from, node.to)) ? '☑ ' : '☐ ');
      default:
        return node.firstChild ? this.inline(node) : this.text(this.slice(node.from, node.to));
    }
  }

  /**
   * A link (or an image) as AO3 takes it, to its address or the reference
   * the note defines; one to an address it shouldn't follow, as its words;
   * brackets that link nowhere ("[sic]", "[...]"), as written.
   */
  link(node: SyntaxNode): string {
    const marks = node.getChildren('LinkMark');
    const open = marks[0];
    const close = marks.find((mark) => this.slice(mark.from, mark.to) === ']');
    if (!open || !close) return this.inline(node);
    const url = node.getChild('URL');
    const href = url
      ? destination(this.slice(url.from, url.to))
      : this.#references.of(node, this.#source, this.slice(open.to, close.from));
    const image = node.name === 'Image';
    if (href === null) {
      const label = node.getChild('LinkLabel');
      const start = this.text(image ? '![' : '[');
      const words = this.inline(node, open.to, close.from);
      const end = this.text(label ? `]${this.slice(label.from, label.to)}` : ']');
      return start + words + end;
    }
    const words = this.inline(node, open.to, close.from);
    // A book carries no images yet: an image is its description.
    if (!this.#follows(href) || (image && this.#book)) return words;
    // A book's reader takes no space in an address (an EPUB checker, Word): written as %20.
    const address = this.#book ? href.replace(/ /gu, '%20') : href;
    if (!image) return `<a href="${escapeAttr(address)}">${words}</a>`;
    const alt = decodeEntities(words.replace(/<[^>]*>/g, ''));
    return `<img src="${escapeAttr(href)}" alt="${escapeAttr(alt)}" />`;
  }

  /** HTML in the note: the tags AO3 takes kept, anything else shown as text. */
  html(source: string, allowed: ReadonlySet<string>): string {
    const match = /^<(\/?)([A-Za-z][A-Za-z0-9]*)\b[^>]*?(\/?)>$/u.exec(source.trim());
    const name = match?.[2]?.toLowerCase();
    if (match && name && allowed.has(name)) {
      // A line or a paragraph of the note's own HTML starts here: a quote after it opens.
      if (BREAKS.has(name)) this.startLine();
      if (name === 'br' || name === 'hr') return `<${name} />`;
      if (match[1] !== '/') {
        const silent = (this.#active.get(name) ?? 0) > 0; // already open: it doesn't open again
        this.#open.push({ name, silent });
        this.#count(name, 1);
        return silent ? '' : `<${name}>`;
      }
      // A closing tag closes what it opened (and anything opened since); one with nothing to close goes.
      const at = this.#open.map((open) => open.name).lastIndexOf(name);
      if (at < this.#floor) return ''; // opened outside the element it's in: it can't close here
      return this.#closeFrom(at);
    }
    return this.text(source);
  }

  /**
   * A block's words, as lines: a line of only marks or stray tags is no line
   * (no line break for it), and the HTML it left open is closed.
   */
  lines(node: SyntaxNode): string {
    this.startLine();
    return this.closed(trimSpaces(shownLines(trimSpaces(this.inline(node)))));
  }

  /** `inner`, with the HTML tags it left open closed: AO3 gets whole elements. */
  closed(inner: string): string {
    return inner + this.#closeFrom(0);
  }

  /** Close the note's own tags opened from `depth` on, latest first. */
  #closeFrom(depth: number): string {
    return this.#open
      .splice(depth)
      .reverse()
      .map((open) => {
        this.#count(open.name, -1);
        return open.silent ? '' : `</${open.name}>`;
      })
      .join('');
  }

  #count(tag: string, by: number): void {
    this.#active.set(tag, (this.#active.get(tag) ?? 0) + by);
  }
}
