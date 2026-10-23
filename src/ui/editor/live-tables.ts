// Tables in Live and Reading (spec §4): drawn in place, row by row, so a cell
// is text the caret can go into and typing edits the table's Markdown. Each
// row is a line laid out as a row of equal columns; its pipes hide, the
// delimiter row under the header hides, and the words in a cell are
// formatted as they are anywhere else. The file stays a plain GFM table.

import { syntaxTree } from '@codemirror/language';
import { type EditorState, type Range, StateField, type Text } from '@codemirror/state';
import { Decoration, type DecorationSet, EditorView } from '@codemirror/view';
import type { SyntaxNode } from '@lezer/common';
import { type Align, alignOf, leadOf, pipesIn } from '../../core/table';
import { previewMode } from './preview-mode';

export interface Span {
  readonly from: number;
  readonly to: number;
}

export interface TableRow {
  readonly from: number;
  readonly to: number;
  /** The header, the delimiter row under it ("|---|---|"), or a row of the body. */
  readonly kind: 'head' | 'rule' | 'body';
  /** What each cell holds, its spaces too: where the caret goes to edit it. */
  readonly cells: readonly Span[];
  /** Each pipe, with the spaces before the first and after the last. */
  readonly pipes: readonly Span[];
}

/** The rows of the table `table` is, line by line, split as GFM splits them: on "|", not "\|". */
export function tableRows(doc: Text, table: SyntaxNode): TableRow[] {
  const rows: TableRow[] = [];
  const first = doc.lineAt(table.from).number;
  const last = doc.lineAt(table.to).number;
  let quoted = false;
  for (let node = table.parent; node; node = node.parent) quoted ||= node.name === 'Blockquote';
  for (let n = first; n <= last; n++) {
    const line = doc.line(n);
    const kind = n === first ? 'head' : n === first + 1 ? 'rule' : 'body';
    // In a quote, the ">" before each row is the quote's, not a cell.
    const lead = quoted ? leadOf(line.text, true) : 0;
    rows.push({ from: line.from, to: line.to, kind, ...splitRow(line.text, line.from, lead) });
  }
  return rows;
}

/** A row's cells and pipes, at `offset` in the note, its first `lead` characters not its own. */
function splitRow(text: string, offset: number, lead: number): Pick<TableRow, 'cells' | 'pipes'> {
  const bars = pipesIn(text, lead);
  const blank = (from: number, to: number) => text.slice(from, to).trim() === '';
  const edges = [lead - 1, ...bars, text.length];
  const cells: Span[] = [];
  const pipes: Span[] = [];
  for (let i = 0; i + 1 < edges.length; i++) {
    const from = (edges[i] as number) + 1;
    const to = edges[i + 1] as number;
    const outer = i === 0 || i + 1 === edges.length - 1;
    // Before a leading pipe or after a trailing one there's no cell, only spaces.
    if (outer && bars.length > 0 && blank(from, to)) continue;
    cells.push({ from: offset + from, to: offset + to });
  }
  for (const [i, bar] of bars.entries()) {
    const from = i === 0 && blank(lead, bar) ? lead : bar;
    const to = i === bars.length - 1 && blank(bar + 1, text.length) ? text.length : bar + 1;
    pipes.push({ from: offset + from, to: offset + to });
  }
  return { cells, pipes };
}

/** Every table in the note, as its syntax node. Tables sit in the document, a quote or a list. */
export function tablesIn(state: EditorState): SyntaxNode[] {
  const found: SyntaxNode[] = [];
  syntaxTree(state).iterate({
    enter(node) {
      if (node.name === 'Table') {
        found.push(node.node);
        return false;
      }
      return CONTAINERS.has(node.name) ? undefined : false;
    },
  });
  return found;
}

const CONTAINERS = new Set(['Document', 'Blockquote', 'BulletList', 'OrderedList', 'ListItem']);

/** A cell, as its column is aligned: right-aligned figures in tabular figures. */
const CELLS: Record<Align, Decoration> = {
  left: Decoration.mark({ class: 'eien-cell' }),
  center: Decoration.mark({ class: 'eien-cell eien-cell--center' }),
  right: Decoration.mark({ class: 'eien-cell eien-cell--right' }),
};

function cellsOf(state: EditorState): DecorationSet {
  if (!state.facet(previewMode)) return Decoration.none;
  const out: Range<Decoration>[] = [];
  for (const table of tablesIn(state)) {
    const rows = tableRows(state.doc, table);
    const aligns = (rows[1]?.cells ?? []).map(({ from, to }) =>
      alignOf(state.doc.sliceString(from, to)),
    );
    for (const row of rows) {
      for (const [c, { from, to }] of row.cells.entries())
        if (to > from) out.push(CELLS[aligns[c] ?? 'left'].range(from, to));
    }
  }
  return Decoration.set(out, true);
}

/**
 * Each cell as one element, the row's column. These go in the outer
 * decorations, which wrap round every other mark: a bold word in a cell is
 * inside the cell's element, never splitting it into two columns.
 */
export const tableCells = StateField.define<DecorationSet>({
  create: cellsOf,
  update(value, tr) {
    const parsed = syntaxTree(tr.state) !== syntaxTree(tr.startState);
    const modeChanged = tr.state.facet(previewMode) !== tr.startState.facet(previewMode);
    return tr.docChanged || parsed || modeChanged ? cellsOf(tr.state) : value;
  },
  provide: (field) => EditorView.outerDecorations.from(field),
});
