// Paste from any HTML (spec §8): the HTML as Eien's Markdown.
// Paragraphs; empty ones (spacer paragraphs) dropped, so spacer, rule, spacer is
// one `***`; emphasis, strikethrough, underline, line breaks, quotes,
// headings, lists, links and images as their Markdown; other tags keep
// their text. What would read as Markdown in the words is escaped, so the
// note says what the HTML said, and Copy as HTML gives the HTML back.

import { declarations } from './css';
import { type HtmlElement, type HtmlNode, parseHtml, trimSpaces } from './html';
import { inline, textOf } from './html-inline';
import { BLOCK, tidy } from './tidy';

const isBlock = (node: HtmlNode) => node.kind === 'element' && BLOCK.has(node.name);

/** A line's start that would read as a block's mark: a heading, a quote, a list, a rule. */
function escapeLineStart(line: string): string {
  return (
    line
      .replace(/^(#{1,6})(?=\s|$)/u, '\\$1')
      .replace(/^>/u, '\\>')
      .replace(/^([-+])(?=\s|$)/u, '\\$1')
      .replace(/^(\d{1,9})([.)])(?=\s|$)/u, '$1\\$2')
      .replace(/^([=-]+)\s*$/u, (rule) => `\\${rule}`)
      // A line like "-|" or "|---|" under another would make a table of the two.
      .replace(/^(?=[ \t]*\|?[ \t]*:?-+:?[ \t]*(?:\|[ \t]*:?-*:?[ \t]*)*$)(?=.*\|)/u, '\\')
  );
}

/** Inline Markdown as paragraphs: a blank line (two line breaks) parts them, each line tidied. */
function paragraphs(markdown: string): string[] {
  return markdown
    .split(/\n[ \t]*\n/u)
    .map((paragraph) =>
      paragraph
        .split('\n')
        // Spaces on either side of a tag are one space, as a browser shows them.
        .map((line) => escapeLineStart(trimSpaces(line.replace(/ {2,}/gu, ' '))))
        .filter((line, i, lines) => line !== '' || (i > 0 && i < lines.length - 1))
        .join('\n'),
    )
    .filter((paragraph) => paragraph.replace(/[\s ]/gu, '') !== '');
}

/** A list's items; `other` gives bullets "*" (a list right after another, which "-" would join). */
/**
 * A list's items: its <li>s, and what's beside them — a list nested straight
 * inside its parent list (as Google Docs nests them) goes in the item before
 * it, and words outside any item are an item of their own.
 */
function itemsOf(element: HtmlElement): HtmlNode[][] {
  const items: HtmlNode[][] = [];
  let loose = false;
  for (const child of element.children) {
    if (child.kind === 'element' && child.name === 'li') {
      items.push([...child.children]);
      loose = false;
      continue;
    }
    if (child.kind === 'text' && !child.text.trim()) continue;
    const nested = child.kind === 'element' && (child.name === 'ul' || child.name === 'ol');
    const last = items[items.length - 1];
    if (last && (nested || loose)) last.push(child);
    else {
      items.push([child]);
      loose = !nested;
    }
  }
  return items;
}

function list(element: HtmlElement, other = false): string {
  let n = Number.parseInt(element.attrs.start ?? '1', 10);
  if (!Number.isFinite(n)) n = 1;
  return itemsOf(element)
    .map((item) => {
      const body = blocks(item).join('\n\n');
      if (!body.trim()) return ''; // an empty item isn't kept, and doesn't take a number
      const marker = element.name === 'ol' ? `${n++}${other ? ')' : '.'} ` : other ? '* ' : '- ';
      return body
        .split('\n')
        .map((line, i) => (i === 0 ? marker + line : line ? ' '.repeat(marker.length) + line : ''))
        .join('\n');
    })
    .filter(Boolean)
    .join('\n');
}

/** A cell's words on one line: its paragraphs (Word and Google Docs put one in every cell) parted by a line break. */
const cellText = (cell: HtmlElement): string =>
  cell.children.some(isBlock) ? blocks(cell.children).join('<br>') : inline(cell.children);

function table(element: HtmlElement): string {
  const rows: string[][] = [];
  const collect = (nodes: readonly HtmlNode[]) => {
    for (const node of nodes) {
      if (node.kind !== 'element') continue;
      if (node.name === 'tr') {
        rows.push(
          node.children
            .filter(
              (cell): cell is HtmlElement =>
                cell.kind === 'element' && (cell.name === 'td' || cell.name === 'th'),
            )
            .map((cell) => cellText(cell).replace(/\n/gu, ' ').replace(/\|/gu, '\\|').trim()),
        );
      } else collect(node.children);
    }
  };
  collect(element.children);
  if (rows.length === 0) return '';
  const width = Math.max(...rows.map((row) => row.length));
  const line = (cells: string[]) =>
    `| ${Array.from({ length: width }, (_, i) => cells[i] ?? '').join(' | ')} |`;
  const [head = [], ...body] = rows;
  return [line(head), `|${' --- |'.repeat(width)}`, ...body.map(line)].join('\n');
}

/** The Markdown blocks of `nodes`: paragraphs, headings, quotes, lists, code, rules. */
function blocks(nodes: readonly HtmlNode[]): string[] {
  const out: string[] = [];
  let pending: HtmlNode[] = [];
  const flush = () => {
    if (pending.length) out.push(...paragraphs(inline(pending)));
    pending = [];
  };
  for (const node of nodes) {
    if (!isBlock(node)) {
      pending.push(node);
      continue;
    }
    flush();
    const element = node as HtmlElement;
    const heading = /^h([1-6])$/u.exec(element.name);
    if (heading) {
      const text = inline(element.children)
        .replace(/\s*\n\s*/gu, ' ')
        .replace(/ {2,}/gu, ' ')
        .replace(/^[ \t]+|[ \t]+$/gu, '')
        // "#"s ending a heading would read as its closing marks.
        .replace(/(^|\s)(#+)$/u, '$1\\$2');
      if (text) out.push(`${'#'.repeat(Math.max(1, Number(heading[1]) - 1))} ${text}`);
      continue;
    }
    switch (element.name) {
      case 'hr':
        out.push('***');
        break;
      case 'blockquote': {
        const inner = blocks(element.children).join('\n\n');
        if (inner)
          out.push(
            inner
              .split('\n')
              .map((line) => (line ? `> ${line}` : '>'))
              .join('\n'),
          );
        break;
      }
      case 'ul':
      case 'ol': {
        // Two lists side by side stay two: the second marks its items another way.
        const last = out[out.length - 1] ?? '';
        const follows = element.name === 'ul' ? /^- /u.test(last) : /^\d+\. /u.test(last);
        const items = list(element, follows);
        if (items) out.push(items);
        break;
      }
      case 'li':
        out.push(list({ kind: 'element', name: 'ul', attrs: {}, children: [element] }));
        break;
      case 'pre': {
        const code = textOf(element.children).replace(/^\n/u, '').replace(/\n$/u, '');
        const fence = code.includes('```') ? '````' : '```';
        if (code.trim()) out.push(`${fence}\n${code}\n${fence}`);
        break;
      }
      case 'table': {
        const caption = element.children.find(
          (child): child is HtmlElement => child.kind === 'element' && child.name === 'caption',
        );
        if (caption) out.push(...paragraphs(inline(caption.children)));
        const md = table(element);
        if (md) out.push(md);
        break;
      }
      default:
        out.push(...blocks(element.children));
    }
  }
  flush();
  return out;
}

/** `html` as Markdown: its blocks parted by blank lines. */
export function fromHtml(html: string): string {
  return blocks(tidy(parseHtml(html))).join('\n\n');
}

/**
 * Whether `nodes` are code, as a code editor copies it: all of it in one
 * <pre> or <code>, or in one element set in a fixed-width face or as `pre`.
 */
function isCode(nodes: readonly HtmlNode[]): boolean {
  const shownOf = (list: readonly HtmlNode[]) =>
    list.filter((node) =>
      node.kind === 'element' ? node.name !== 'meta' : node.text.trim() !== '',
    );
  let shown = shownOf(nodes);
  // A whole document (Windows' clipboard, a JetBrains IDE): what its body holds.
  while (
    shown.length === 1 &&
    shown[0]?.kind === 'element' &&
    /^(?:html|body)$/u.test(shown[0].name)
  ) {
    shown = shownOf(shown[0].children);
  }
  const only = shown[0];
  if (shown.length !== 1 || only?.kind !== 'element') return false;
  if (only.name === 'pre' || only.name === 'code') return true;
  const css = declarations(only.attrs.style ?? '');
  return (
    css.get('white-space') === 'pre' ||
    /monospace|courier|menlo|monaco|consolas/u.test(css.get('font-family') ?? '')
  );
}

/**
 * What a paste becomes in a note: its HTML (or its plain text, when that is
 * really HTML) as Markdown; null to paste the plain text as it is, as for
 * code copied from a code editor, or HTML with nothing in it.
 */
export function pastedMarkdown(html: string, text: string): string | null {
  const source = html || (looksLikeHtml(text) ? text : '');
  if (!source) return null;
  const nodes = parseHtml(source);
  if (html && text && isCode(nodes)) return null;
  const markdown = blocks(tidy(nodes)).join('\n\n');
  if (!markdown) return null;
  if (markdown.includes('\n')) return markdown;
  // Words pasted into a line keep the spaces at their edges: "He said" + " hello".
  const lead = /^[ \t\u00a0]/u.test(text) ? ' ' : '';
  const trail = /[ \t\u00a0]$/u.test(text) ? ' ' : '';
  return lead + markdown + trail;
}

/**
 * Whether plain text is really HTML, as some notes apps copy it: it starts
 * with a tag and holds a closing tag or a line break.
 */
export function looksLikeHtml(text: string): boolean {
  const start = text.trimStart();
  return (
    /^<(?:p|div|h[1-6]|blockquote|ul|ol|em|strong|i|b|span|br|hr)\b[^>]*>/iu.test(start) &&
    /<\/(?:p|div|h[1-6]|blockquote|ul|ol|li|em|strong|i|b|span)>|<br\s*\/?>|<hr\s*\/?>/iu.test(
      start,
    )
  );
}
