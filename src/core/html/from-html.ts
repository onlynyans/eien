// Paste from any HTML (spec §8): the HTML as Eien's Markdown.
// Paragraphs; empty ones (spacer paragraphs) dropped, so spacer, rule, spacer is
// one `***`; emphasis, strikethrough, underline, line breaks, quotes,
// headings, lists, links and images as their Markdown; other tags keep
// their text. What would read as Markdown in the words is escaped, and only
// that (./marks-in-words.ts), so the note says what the HTML said, and Copy
// as HTML gives the HTML back.

import { pipesIn } from '../table';
import { declarations } from './css';
import { type HtmlElement, type HtmlNode, parseHtml, trimSpaces } from './html';
import { inline, textOf } from './html-inline';
import { NONCHARACTERS, settle } from './marks-in-words';
import { BLOCK, tidy } from './tidy';

const isBlock = (node: HtmlNode) => node.kind === 'element' && BLOCK.has(node.name);

/**
 * A table's delimiter row ("|---|:-:|", "-|"), with a pipe somewhere. Each cell's spaces, dashes
 * and colons can be read only one way: when a cell's spaces could go before or after nothing,
 * a line of empty cells that failed at its end ("-| | | … x") was tried twice over for each.
 */
const DELIMITER_ROW =
  /^(?=[ \t]*(?:\|[ \t]*)?:?-+:?[ \t]*(?:\|[ \t]*(?:(?::-*:?|-+:?)[ \t]*)?)*$)(?=.*\|)/u;

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
      .replace(DELIMITER_ROW, '\\')
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

/** Whether `node` is an <li>, or wraps one in elements of no meaning ("<div><li>", as Google's answers write them). */
const holdsItem = (node: HtmlNode): boolean =>
  node.kind === 'element' &&
  (node.name === 'li' || (/^(?:div|span)$/u.test(node.name) && node.children.some(holdsItem)));

/** A list's children with the wrappers round its items taken off. */
const unwrapped = (nodes: readonly HtmlNode[]): HtmlNode[] =>
  nodes.flatMap((node) =>
    node.kind === 'element' && node.name !== 'li' && holdsItem(node)
      ? unwrapped(node.children)
      : [node],
  );

/**
 * A list's items: its <li>s (out of any wrappers), and what's beside them —
 * a list nested straight inside its parent list (as Google Docs nests them)
 * goes in the item before it, and words outside any item are an item of
 * their own.
 */
function itemsOf(element: HtmlElement): HtmlNode[][] {
  const items: HtmlNode[][] = [];
  let loose = false;
  for (const child of unwrapped(element.children)) {
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

/**
 * A cell's Markdown with each pipe that would end it escaped, as a table reads its pipes: a pipe
 * already escaped stays as it is, so code holding "\|" doesn't become "\\|", which ends the cell.
 */
function pipesEscaped(cell: string): string {
  let out = '';
  let at = 0;
  for (const bar of pipesIn(cell)) {
    out += `${cell.slice(at, bar)}\\`;
    at = bar;
  }
  return out + cell.slice(at);
}

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
            .map((cell) => pipesEscaped(cellText(cell).replace(/\n/gu, ' ').trim())),
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

/** HTML read for pasting: a noncharacter is a held mark's (no page means one). */
const pasted = (html: string) => parseHtml(html.replace(NONCHARACTERS, ''));

/** `nodes` as Markdown: their blocks, each settled, parted by blank lines. */
const markdownOf = (nodes: readonly HtmlNode[]): string =>
  blocks(tidy(nodes)).map(settle).join('\n\n');

/** `html` as Markdown. */
export const fromHtml = (html: string): string => markdownOf(pasted(html));

/** Words with their runs of spaces and line ends as one space: to tell the same words apart from their layout. */
const wordsOf = (text: string) => text.replace(/\s+/gu, ' ').trim();

/**
 * Whether `nodes` are an editor's copy of `typed`, the text as written: all
 * of it in one <pre> or <code>, or in one element set in a fixed-width face
 * or as `pre` (a code editor's); or kept as typed with its tabs set
 * (Sublime Text's Copy as HTML, in any face) and the same words.
 */
function isTyped(nodes: readonly HtmlNode[], typed: string): boolean {
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
    /monospace|courier|menlo|monaco|consolas/u.test(css.get('font-family') ?? '') ||
    // Kept as typed with tabs set: an editor's, as a page copied from a browser never sets them.
    (css.get('white-space') === 'pre-wrap' &&
      (css.has('tab-size') || css.has('-moz-tab-size')) &&
      wordsOf(textOf([only])) === wordsOf(typed))
  );
}

/**
 * What a paste becomes in a note: its HTML (or its plain text, when that is
 * really HTML) as Markdown; null to paste the plain text as it is, as for
 * code copied from a code editor, or HTML with nothing in it. An editor's
 * copy is its text as typed: the plain text, or the HTML's own words when
 * the plain text is that HTML too (Sublime Text's Copy as HTML).
 */
export function pastedMarkdown(html: string, text: string): string | null {
  const textIsHtml = looksLikeHtml(text);
  const source = html || (textIsHtml ? text : '');
  if (!source) return null;
  const nodes = pasted(source);
  if (html && text) {
    const typed = textIsHtml ? textOf(nodes) : text;
    if (isTyped(nodes, typed)) return textIsHtml ? typed : null;
  }
  const markdown = markdownOf(nodes);
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
