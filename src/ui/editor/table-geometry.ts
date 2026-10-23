// Where a table's rows and columns are on the page, measured for the
// controls laid over it (./table-tools.ts), in the editor's own box. Rows
// from the editor's line blocks; columns from the head row's cells, which
// Live draws as equal columns (./live-tables.ts).

import type { EditorView } from '@codemirror/view';
import { bodyRowsOf, columnsOf, lineOfRow } from '../../core/table';
import type { TableAt } from './table-at';

export interface TableGeometry {
  /** The table's left and right edges, and its top and bottom. */
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
  /** Each column's left edge and width. */
  readonly columns: readonly { readonly x: number; readonly w: number }[];
  /** Each row's top and height: the head row first, the delimiter row left out. */
  readonly rows: readonly { readonly y: number; readonly h: number }[];
}

/** The line element `pos` is drawn in, or null when it isn't drawn (out of the viewport). */
function lineElement(view: EditorView, pos: number): HTMLElement | null {
  const { node } = view.domAtPos(pos);
  const element = node instanceof HTMLElement ? node : node.parentElement;
  return element?.closest<HTMLElement>('.cm-line') ?? null;
}

/** `table` measured, or null when its head row isn't drawn. Call in a measure's read. */
export function measureTable(view: EditorView, table: TableAt): TableGeometry | null {
  const head = lineElement(view, table.from);
  if (!head) return null;
  const box = view.dom.getBoundingClientRect();
  const line = head.getBoundingClientRect();
  const n = columnsOf(table.lines);
  const cells = [...head.querySelectorAll<HTMLElement>(':scope > .eien-cell')];
  const columns =
    cells.length === n
      ? cells.map((cell) => {
          const at = cell.getBoundingClientRect();
          return { x: at.left - box.left, w: at.width };
        })
      : Array.from({ length: n }, (_, c) => ({
          x: line.left - box.left + (c * line.width) / n,
          w: line.width / n,
        }));
  const first = view.state.doc.lineAt(table.from).number;
  const offset = view.documentTop - box.top;
  const rows = Array.from({ length: bodyRowsOf(table.lines) + 1 }, (_, r) => {
    const block = view.lineBlockAt(view.state.doc.line(first + lineOfRow(r)).from);
    return { y: block.top + offset, h: block.height };
  });
  const last = rows.at(-1);
  return {
    left: line.left - box.left,
    right: line.right - box.left,
    top: rows[0]?.y ?? 0,
    bottom: last ? last.y + last.h : 0,
    columns,
    rows,
  };
}

/** The x of the line before column `c` (`c` past the last: the table's right edge). */
export const columnLine = (g: TableGeometry, c: number): number => {
  const column = g.columns[c];
  if (column) return column.x;
  const last = g.columns.at(-1);
  return last ? last.x + last.w : g.right;
};

/** The y of the line above row `at` under the head (0: under the head row; the last: the table's foot). */
export const rowLine = (g: TableGeometry, at: number): number => g.rows[at + 1]?.y ?? g.bottom;

/** The line between columns or rows nearest the pointer at (x, y), if it's close enough to show its +. */
export function nearLine(
  g: TableGeometry,
  x: number,
  y: number,
): { readonly dir: 'column' | 'row'; readonly at: number } | null {
  let best: { dir: 'column' | 'row'; at: number; d: number } | null = null;
  const consider = (dir: 'column' | 'row', at: number, d: number, max: number) => {
    if (d <= max && (!best || d < best.d)) best = { dir, at, d };
  };
  // Closer in the margins, where the + stands, so the pointer can follow the line out to it.
  if (y >= g.top - 26 && y <= g.bottom) {
    for (let c = 0; c <= g.columns.length; c++)
      consider('column', c, Math.abs(x - columnLine(g, c)), y < g.top ? 10 : 6);
  }
  if (x >= g.left - 52 && x <= g.right) {
    for (let at = 0; at < g.rows.length; at++)
      consider('row', at, Math.abs(y - rowLine(g, at)), x < g.left ? 10 : 5);
  }
  const found = best as { dir: 'column' | 'row'; at: number } | null;
  return found ? { dir: found.dir, at: found.at } : null;
}

/** Where a row or column dragged from `from` lands, for a pointer at `p` (x for columns, y for rows). */
export function dropAt(
  g: TableGeometry,
  kind: 'row' | 'column',
  from: number,
  p: number,
): { readonly to: number; readonly line: number } {
  if (kind === 'row') {
    const rest = g.rows.slice(1).filter((_, i) => i + 1 !== from);
    const to = rest.filter((row) => row.y + row.h / 2 < p).length;
    const at = rest[to];
    const last = rest.at(-1);
    return { to, line: at ? at.y : last ? last.y + last.h : g.bottom };
  }
  const rest = g.columns.filter((_, i) => i !== from);
  const to = rest.filter((column) => column.x + column.w / 2 < p).length;
  const at = rest[to];
  const last = rest.at(-1);
  return { to, line: at ? at.x : last ? last.x + last.w : g.right };
}
