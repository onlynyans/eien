// What the editor does with what's typed and pasted (spec §4, §8): a typed
// quote follows the vault's setting, curled by what's around it; pasted
// HTML (AO3's, a web page's, or plain text that is really HTML) becomes
// Markdown. Code, addresses, HTML tags and front matter are left as typed.
// The decisions are plain functions of the editor's state; the extensions
// only hand them what was typed or pasted.

import { syntaxTree } from '@codemirror/language';
import {
  type EditorState,
  type Extension,
  Transaction,
  type TransactionSpec,
} from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { decodeEntities, pastedMarkdown } from '../../core/ao3';
import { frontMatterEnd } from '../../core/text';
import { CONTEXT, curlyQuote, type QuoteStyle, revisedQuote } from '../../core/typography';

/** Nodes whose text is the machine's, not prose: a quote typed there stays straight. */
const LITERAL = new Set([
  'InlineCode',
  'FencedCode',
  'CodeBlock',
  'CodeText',
  'HTMLTag',
  'URL',
  'Autolink',
  'Comment',
  'LinkReference',
  'LinkTitle',
  'WikiLink',
]);

/**
 * Begun on the line and not yet closed, and the machine's: a tag ("<span
 * title="), a wiki link ("[[Don't"), a link's address or title ("](url "").
 */
const OPEN_LITERAL = [
  /<[A-Za-z][A-Za-z0-9-]*(?:\s[^<>]*)?$/u,
  /\[\[(?:(?!\]\]).)*$/u,
  /\]\([^)]*$/u,
];

/** Literal nodes that end with a mark of their own: just past it is prose again. */
const CLOSED = new Set(['InlineCode', 'HTMLTag', 'Autolink', 'Comment', 'WikiLink']);

/** Whether a code span is begun and not yet closed by the end of `text`: its backtick runs, paired by length. */
function codeOpen(text: string): boolean {
  let open = 0;
  for (const run of text.matchAll(/`+/gu)) {
    if (open === 0) open = text[(run.index ?? 0) - 1] === '\\' ? 0 : run[0].length;
    else if (run[0].length === open) open = 0;
  }
  return open > 0;
}

/** Whether `pos` is in code (or code being typed), an address, an HTML tag or the front matter. */
export function isLiteralAt(state: EditorState, pos: number): boolean {
  const head = state.doc.sliceString(0, Math.min(state.doc.length, 65_536));
  if (pos < frontMatterEnd(head)) return true;
  const line = state.doc.lineAt(pos);
  const lineBefore = state.doc.sliceString(Math.max(line.from, pos - 500), pos);
  if (OPEN_LITERAL.some((open) => open.test(lineBefore)) || codeOpen(lineBefore)) return true;
  for (let node = syntaxTree(state).resolveInner(pos, -1); ; node = node.parent) {
    if (LITERAL.has(node.name) && !(CLOSED.has(node.name) && node.to === pos)) return true;
    // A comment's block runs to its line's end: the words after "-->" are prose.
    if (node.name === 'CommentBlock') {
      const text = state.doc.sliceString(node.from, pos);
      if (text.lastIndexOf('<!--') > text.lastIndexOf('-->')) return true;
    }
    if (!node.parent) return false;
  }
}

/** The line's text before `pos` that decides a quote there; a quote mark's ">" is the line's start. */
function textBefore(state: EditorState, pos: number): string {
  const line = state.doc.lineAt(pos);
  const before = state.doc.sliceString(Math.max(line.from, pos - CONTEXT), pos);
  return pos - line.from <= CONTEXT && /^(?:[ \t]*>)+[ \t]*$/u.test(before) ? '' : before;
}

/** A trailing entity ("&nbsp;") as the character it shows, which decides a quote after it. */
const shown = (before: string) =>
  before.replace(/&(?:#x[0-9a-f]{1,6}|#\d{1,7}|[a-z][a-z0-9]{1,31});$/iu, decodeEntities);

/**
 * Typing `text` over from–to, its quotes as `style` asks: a straight quote
 * curled by what's around it (one after a backslash is the writer's, and
 * stays), and a quote curled before made right once what's typed after it
 * shows which way it goes ("’90s", "’tis", "—“No").
 * Null to type it as it is.
 */
export function typedText(
  state: EditorState,
  from: number,
  to: number,
  text: string,
  style: QuoteStyle,
): TransactionSpec | null {
  if (style === 'straight' || text.length !== 1 || state.readOnly) return null;
  const before = textBefore(state, from);
  const quote = (text === '"' || text === "'") && !/(?:^|[^\\])(?:\\\\)*\\$/u.test(before);
  const revised = revisedQuote(before, text);
  if ((!quote && !revised) || isLiteralAt(state, from)) return null;
  const after = state.doc.sliceString(to, Math.min(state.doc.length, to + 12));
  const insert = quote ? curlyQuote(text as '"' | "'", shown(before), after) : text;
  const changes = [{ from, to, insert }];
  if (revised) {
    const at = from - before.length + revised.at;
    changes.unshift({ from: at, to: at + 1, insert: revised.mark });
  }
  return {
    changes,
    selection: { anchor: from + insert.length },
    userEvent: 'input.type',
    scrollIntoView: true,
  };
}

/** Typed quotes as the setting asks (straight: as typed). */
export function quoteTyping(style: QuoteStyle): Extension {
  if (style === 'straight') return [];
  return EditorView.inputHandler.of((view, from, to, text) => {
    const { main } = view.state.selection;
    const spec =
      main.from === from && main.to === to ? typedText(view.state, from, to, text, style) : null;
    if (!spec) return false;
    view.dispatch(spec);
    return true;
  });
}

/** A line's quote marks and list item, and what its later lines need to stay in them. */
const LINE_HEAD = /^((?:[ \t]*>[ \t]?)*)([ \t]*(?:[-+*]|\d{1,9}[.)])[ \t]+)?/u;

/**
 * What a paste puts in place of the selection: its HTML as Markdown, each
 * later line kept in the quote or list item it's pasted into; null to paste
 * its plain text.
 */
export function pastedText(state: EditorState, html: string, text: string): string | null {
  const { from } = state.selection.main;
  if (state.readOnly || isLiteralAt(state, from)) return null;
  const markdown = pastedMarkdown(html, text);
  if (markdown === null || !markdown.includes('\n')) return markdown;
  const line = state.doc.lineAt(from);
  const [head = '', quotes = '', item = ''] = LINE_HEAD.exec(line.text) ?? [];
  if (!head || from < line.from + head.length) return markdown;
  const prefix = quotes + ' '.repeat(item.length);
  return markdown
    .split('\n')
    .map((each, i) => (i === 0 ? each : each ? prefix + each : prefix.trimEnd()))
    .join('\n');
}

/** Pasted HTML as Markdown; plain text, and anything pasted into code, as it is. */
export const htmlPaste: Extension = EditorView.domEventHandlers({
  paste(event, view) {
    const data = event.clipboardData;
    if (!data) return false;
    const markdown = pastedText(view.state, data.getData('text/html'), data.getData('text/plain'));
    if (markdown === null) return false;
    event.preventDefault();
    view.dispatch(view.state.replaceSelection(markdown), {
      annotations: Transaction.userEvent.of('input.paste'),
      scrollIntoView: true,
    });
    return true;
  },
});
