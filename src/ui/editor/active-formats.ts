// Which of the Format menu's commands are on where the caret is (backlog
// #14): the formatting bar shows them pressed. Read off the syntax tree
// CodeMirror keeps anyway, at the caret alone, so it costs a few steps up
// from a leaf, however long the note.

import { syntaxTree } from '@codemirror/language';
import type { EditorState } from '@codemirror/state';
import type { SyntaxNode } from '@lezer/common';
import type { FormatCommandId } from '../../core/format';

/** The tree's nodes that are a command's format. */
const NODES: Readonly<Record<string, FormatCommandId>> = {
  StrongEmphasis: 'bold',
  Emphasis: 'italic',
  Strikethrough: 'strike',
  Highlight: 'highlight',
  Link: 'link',
  Blockquote: 'quote',
  ATXHeading1: 'heading1',
  ATXHeading2: 'heading2',
  ATXHeading3: 'heading3',
  SetextHeading1: 'heading1',
  SetextHeading2: 'heading2',
  OrderedList: 'numbered',
  BulletList: 'bullet',
  Task: 'checklist',
};

/** The line's own formats, as against its words'. */
const LINE_FORMATS = new Set<FormatCommandId>([
  'quote',
  'heading1',
  'heading2',
  'heading3',
  'numbered',
  'bullet',
  'checklist',
]);

function collect(node: SyntaxNode | null, into: Set<FormatCommandId>, lineOnly = false): void {
  for (let at = node; at; at = at.parent) {
    const format = NODES[at.name];
    if (format && (!lineOnly || LINE_FORMATS.has(format))) into.add(format);
  }
}

/** The formats on at the selection's head: its line's (heading, quote, list) and its words'. */
export function activeFormats(state: EditorState): ReadonlySet<FormatCommandId> {
  const tree = syntaxTree(state);
  const head = state.selection.main.head;
  const line = state.doc.lineAt(head);
  const on = new Set<FormatCommandId>();
  // The line's own format from its first character: the caret may be at its very start.
  const indent = /^[ \t]*/.exec(line.text)?.[0].length ?? 0;
  collect(tree.resolveInner(line.from + indent, 1), on, true);
  // The words' from either side: at a bold word's end, bold is still on.
  collect(tree.resolveInner(head, -1), on);
  collect(tree.resolveInner(head, 1), on);
  // <u> is HTML to the tree: an open tag before the caret, on its line, not yet closed.
  const before = line.text.slice(0, head - line.from).toLowerCase();
  if (before.split('<u>').length > before.split('</u>').length) on.add('underline');
  // A checklist's items are a bulleted list's: the checklist is what's on.
  if (on.has('checklist')) on.delete('bullet');
  return on;
}
