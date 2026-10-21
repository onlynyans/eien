// Copy for AO3 (spec §8): a note's Markdown as the HTML AO3 takes.
// Paragraphs, line breaks, scene breaks, emphasis, strikethrough and
// underline, quotes and headings as the spec's table says; lists, links,
// images, code and tables as AO3 allows them; what AO3 has no tag for (a
// highlight, a wiki link) as its words. Quotes follow the vault's setting;
// code keeps its own. Front matter is the note's data, never posted.

import type { SyntaxNode } from '@lezer/common';
import { eienParser } from '../markdown';
import { frontMatterEnd } from '../text';
import type { QuoteStyle } from '../typography';
import { References } from './addresses';
import { escapeHtml, trimSpaces, visible } from './html';
import { INLINE_TAGS, InlineWriter } from './inline-writer';

/** AO3's two (the setting's), and a book's centred stars. */
export type SceneBreakStyle = 'spacer' | 'rule' | 'stars';

export interface Ao3Options {
  readonly quotes: QuoteStyle;
  /** `***` as AO3's spacer, rule, spacer (the default), or a plain rule. */
  readonly sceneBreak: SceneBreakStyle;
}

const SCENE_BREAK: Record<SceneBreakStyle, string> = {
  spacer: '<p><br /></p><hr /><p><br /></p>',
  rule: '<hr />',
  stars: '<p class="scene-break">* * *</p>',
};

/** Block HTML that may stand alone in a note, and AO3 takes. */
const BLOCK_TAGS = new Set(['p', 'hr', 'blockquote', 'div', 'br', ...INLINE_TAGS]);

/** A note's blocks as AO3's: paragraphs, headings, quotes, lists, code, tables, scene breaks. */
class Writer extends InlineWriter {
  readonly #sceneBreak: SceneBreakStyle;
  readonly #book: boolean;

  constructor(source: string, options: Ao3Options, references: References, book = false) {
    super(source, options.quotes, references, book);
    this.#sceneBreak = options.sceneBreak;
    this.#book = book;
  }

  /**
   * An HTML block, as the note shows it: the tags AO3 takes kept (their
   * attributes left behind), any other tag shown as the text it is.
   */
  htmlBlock(source: string): string {
    let out = '';
    let at = 0;
    for (const match of source.matchAll(/<\/?[A-Za-z][A-Za-z0-9]*\b[^<>]*>/gu)) {
      out += this.words(source.slice(at, match.index)) + this.html(match[0], BLOCK_TAGS);
      at = (match.index ?? 0) + match[0].length;
    }
    out = this.closed(trimSpaces(out + this.words(source.slice(at))));
    // Only tags with nothing to show (a stray "</u>", "<u></u>"): not posted.
    if (out.replace(/<(?!hr\b|img\b)[^>]*>/gu, '').trim() === '') return '';
    return /^<(?:p|div|blockquote|hr)\b/u.test(out) ? out : `<p>${out}</p>`;
  }

  /** Words in HTML: its entities kept as they are, the rest escaped, the quotes as set. */
  words(raw: string): string {
    return raw
      .split(/(&(?:#x[0-9a-f]{1,6}|#\d{1,7}|[a-z][a-z0-9]{1,31});)/iu)
      .map((part, i) => (i % 2 === 1 ? this.entity(part) : this.text(part)))
      .join('');
  }

  blocks(parent: SyntaxNode): string[] {
    const out: string[] = [];
    for (let node = parent.firstChild; node; node = node.nextSibling) {
      const block = this.block(node);
      if (block) out.push(block);
    }
    return out;
  }

  block(node: SyntaxNode): string {
    this.startLine();
    const name = node.name;
    const heading = /^(?:ATX|Setext)Heading(\d)$/u.exec(name);
    if (heading) {
      const level = Math.min(Number(heading[1]) + 1, 6);
      // A setext heading's underline is a mark; the line end before it isn't a line break.
      // A heading is one line: its lines are joined by a space.
      const text = trimSpaces(
        this.inline(node)
          .replace(/(?:<br \/>\n)+$/u, '')
          .replace(/<br \/>\n/gu, ' '),
      );
      const words = this.closed(text);
      return visible(words) ? `<h${level}>${words}</h${level}>` : ''; // an empty heading isn't posted
    }
    switch (name) {
      case 'Paragraph': {
        // A line of only marks or stray tags is no line: no line break for it.
        const words = this.lines(node);
        return visible(words) ? `<p>${words}</p>` : ''; // nothing to show: not posted
      }
      case 'HorizontalRule':
        return SCENE_BREAK[this.#sceneBreak];
      case 'Blockquote': {
        const inner = this.blocks(node);
        return inner.length ? `<blockquote>${inner.join('\n')}</blockquote>` : '';
      }
      case 'BulletList':
      case 'OrderedList': {
        const tag = name === 'BulletList' ? 'ul' : 'ol';
        const items = node.getChildren('ListItem').map((item) => {
          // One paragraph (or a checklist's task) and nothing else in it: the item's words alone.
          const parts: SyntaxNode[] = [];
          for (let part = item.firstChild; part; part = part.nextSibling) {
            if (part.name !== 'ListMark') parts.push(part);
          }
          const only = parts.length === 1 ? parts[0] : undefined;
          const inner =
            only && (only.name === 'Paragraph' || only.name === 'Task')
              ? this.lines(only)
              : this.blocks(item).join('\n');
          return visible(inner) ? `<li>${inner}</li>` : ''; // nothing to show: not posted
        });
        const kept = items.filter(Boolean); // an empty item isn't posted
        // A book keeps a numbered list's first number ("1994."); AO3 gets its plain list.
        const first = Number.parseInt(this.slice(node.from, node.to), 10);
        const start = this.#book && tag === 'ol' && first !== 1 ? ` start="${first}"` : '';
        return kept.length ? `<${tag}${start}>${kept.join('\n')}</${tag}>` : '';
      }
      case 'FencedCode':
      case 'CodeBlock': {
        const code = this.code(node);
        // HTML ignores a line end just after <pre>: a first blank line needs one more.
        return code ? `<pre>${code.startsWith('\n') ? '\n' : ''}${escapeHtml(code)}</pre>` : '';
      }
      case 'HTMLBlock':
        return this.htmlBlock(this.contained(node));
      case 'CommentBlock':
        // A comment's block runs to its line's end: words after its "-->" are the writer's.
        return this.htmlBlock(this.contained(node).replace(/<!--[\s\S]*?(?:-->|$)/gu, ''));
      case 'Table':
        return this.table(node);
      case 'ProcessingInstructionBlock':
        // "<?" at a line's start, which runs to a "?>" or the note's end: shown as the words it is.
        return this.htmlBlock(this.contained(node));
      case 'LinkReference':
        return '';
      default: {
        const words = node.firstChild ? this.lines(node) : '';
        return visible(words) ? `<p>${words}</p>` : '';
      }
    }
  }

  /**
   * A block's source as its container holds it: on its later lines, the
   * quote's marks and the list's indent left out (on its first, they're
   * before it).
   */
  contained(node: SyntaxNode): string {
    const indent = this.slice(this.lineStart(node.from), node.from).replace(
      /^(?:[ \t]*>[ \t]?)*/u,
      '',
    ).length;
    let text = '';
    let at = node.from;
    for (let mark = node.firstChild; mark; mark = mark.nextSibling) {
      if (mark.name !== 'QuoteMark') continue;
      text += this.slice(at, mark.from);
      at = mark.to + (this.slice(mark.to, mark.to + 1) === ' ' ? 1 : 0);
    }
    text += this.slice(at, node.to);
    const margin = new RegExp(`^[ \\t]{0,${indent}}`, 'u');
    return text
      .split('\n')
      .map((line, i) => (i === 0 ? line : line.replace(margin, '')))
      .join('\n');
  }

  /** A code block's text, as written: a fence's lines between its marks, or the indented lines. */
  code(node: SyntaxNode): string {
    const source = this.contained(node);
    if (node.name === 'CodeBlock') return source;
    const lines = source.split('\n').slice(1); // after the opening fence's line
    // A closing fence is the second mark; a fence never closed runs to the note's end.
    if (node.getChildren('CodeMark').length > 1) lines.pop();
    return lines.join('\n');
  }

  table(node: SyntaxNode): string {
    const rows: string[] = [];
    for (let row = node.firstChild; row; row = row.nextSibling) {
      if (row.name !== 'TableHeader' && row.name !== 'TableRow') continue;
      const cell = row.name === 'TableHeader' ? 'th' : 'td';
      const cells = row.getChildren('TableCell').map((c) => `<${cell}>${this.lines(c)}</${cell}>`);
      rows.push(`<tr>${cells.join('')}</tr>`);
    }
    return `<table>${rows.join('\n')}</table>`;
  }
}

/**
 * The note's text as AO3 HTML: its front matter left out. With `chosen`,
 * only the words from–to (offsets in `markdown`), their links found by the
 * whole note's references; what's chosen never starts with front matter, so
 * a "---" at its start is a scene break.
 */
export function toAo3Html(
  markdown: string,
  options: Ao3Options,
  chosen?: { readonly from: number; readonly to: number },
): string {
  // A note read from the disk may begin with a byte-order mark: its front matter is still its front matter.
  const source = markdown.replace(/^\uFEFF/u, '').replace(/\r\n?/g, '\n');
  const start = frontMatterEnd(source);
  const body = source.slice(start);
  const tree = eienParser.parse(body);
  const references = new References(tree, body);
  if (!chosen) return new Writer(body, options, references).blocks(tree.topNode).join('\n');
  const part = source.slice(Math.max(chosen.from, start), Math.max(chosen.to, start));
  const writer = new Writer(part, options, references);
  return writer.blocks(eienParser.parse(part).topNode).join('\n');
}

/**
 * A note's body (its front matter already left out) as a book's blocks of
 * HTML (spec §8): as AO3's, but a highlight is <mark>, a scene break centred
 * stars, an image its words, and links go to the web or mail only.
 */
export function bookBlocks(body: string, quotes: QuoteStyle): string[] {
  const source = body.replace(/\r\n?/g, '\n');
  const tree = eienParser.parse(source);
  const writer = new Writer(
    source,
    { quotes, sceneBreak: 'stars' },
    new References(tree, source),
    true,
  );
  return writer.blocks(tree.topNode);
}
