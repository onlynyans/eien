// The table at a place in the note, as the table editor sees it: its lines
// (core/table), where it is in the note, and the cell the place is in.

import { syntaxTree } from '@codemirror/language';
import type { EditorState } from '@codemirror/state';
import type { SyntaxNode } from '@lezer/common';
import { type Here, hereAt, readTable, type TableLine } from '../../core/table';
import { previewMode } from './preview-mode';

export interface TableAt {
  /** Where its first line starts and its last line ends: its lines whole. */
  readonly from: number;
  readonly to: number;
  /** In a quote: each line's ">" is the quote's. */
  readonly quoted: boolean;
  readonly lines: readonly TableLine[];
  /** The cell the place is in. */
  readonly here: Here;
}

/** The table node round `pos`, if there is one. */
function tableNode(state: EditorState, pos: number): SyntaxNode | null {
  const tree = syntaxTree(state);
  for (const side of [-1, 1] as const) {
    for (let node: SyntaxNode | null = tree.resolveInner(pos, side); node; node = node.parent)
      if (node.name === 'Table') return node;
  }
  return null;
}

/** The table `pos` is in (its lines, the spaces round its rows too), or null. */
export function tableAt(state: EditorState, pos: number): TableAt | null {
  const node = tableNode(state, pos);
  if (!node) return null;
  const from = state.doc.lineAt(node.from).from;
  const to = state.doc.lineAt(node.to).to;
  if (pos < from || pos > to) return null;
  let quoted = false;
  for (let up = node.parent; up; up = up.parent) quoted ||= up.name === 'Blockquote';
  const lines = readTable(state.doc.sliceString(from, to), quoted);
  return { from, to, quoted, lines, here: hereAt(lines, pos - from) };
}

/** The table the caret is in, in Live (where the table editor is), or null. */
export function caretTable(state: EditorState): TableAt | null {
  if (state.facet(previewMode) !== 'live') return null;
  return tableAt(state, state.selection.main.head);
}
