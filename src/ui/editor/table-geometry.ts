// Where a table's rows and columns are on the page, measured for the
// controls laid over it (./table-tools.ts), in the controls' own layer: its
// box, at the page's zoom (the sheet's CSS zoom scales what's measured, not
// what's placed). Rows and the head row's cells from their elements; Live
// draws the columns equal when a row's cells can't be told apart.

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
  /** A control's size (`--eien-control`): how near the pointer must come to a line. */
  readonly reach: number;
}

/** The line element `pos` is drawn in, or null when it isn't drawn (out of the viewport). */
function lineElement(view: EditorView, pos: number): HTMLElement | null {
  const { node } = view.domAtPos(pos);
  const element = node instanceof HTMLElement ? node : node.parentElement;
  return element?.closest<HTMLElement>('.cm-line') ?? null;
}

/** How much the page's zoom scales what's measured in `layer`. */
export const zoomOf = (layer: HTMLElement): number =>
  (layer as HTMLElement & { currentCSSZoom?: number }).currentCSSZoom ?? 1;

/** A point on the screen in `layer`'s own coordinates. */
export function inLayer(layer: HTMLElement, x: number, y: number): { x: number; y: number } {
  const box = layer.getBoundingClientRect();
  const zoom = zoomOf(layer);
  return { x: (x - box.left) / zoom, y: (y - box.top) / zoom };
}

/** `table` measured in `layer`, or null when a row isn't drawn. Call in a measure's read. */
export function measureTable(
  view: EditorView,
  table: TableAt,
  layer: HTMLElement,
): TableGeometry | null {
  const first = view.state.doc.lineAt(table.from).number;
  const lines = Array.from({ length: bodyRowsOf(table.lines) + 1 }, (_, r) =>
    lineElement(view, view.state.doc.line(first + lineOfRow(r)).from),
  );
  const head = lines[0];
  if (!head || lines.some((line) => !line)) return null;
  const box = layer.getBoundingClientRect();
  const zoom = zoomOf(layer);
  const x = (at: number) => (at - box.left) / zoom;
  const y = (at: number) => (at - box.top) / zoom;
  const line = head.getBoundingClientRect();
  const n = columnsOf(table.lines);
  const cells = [...head.querySelectorAll<HTMLElement>(':scope > .eien-cell')];
  const columns =
    cells.length === n
      ? cells.map((cell) => {
          const at = cell.getBoundingClientRect();
          return { x: x(at.left), w: at.width / zoom };
        })
      : Array.from({ length: n }, (_, c) => ({
          x: x(line.left + (c * line.width) / n),
          w: line.width / n / zoom,
        }));
  const rows = lines.map((each) => {
    const at = (each as HTMLElement).getBoundingClientRect();
    return { y: y(at.top), h: at.height / zoom };
  });
  const last = rows.at(-1);
  return {
    left: x(line.left),
    right: x(line.right),
    top: rows[0]?.y ?? 0,
    bottom: last ? last.y + last.h : 0,
    columns,
    rows,
    reach: Number.parseFloat(getComputedStyle(layer).getPropertyValue('--eien-control')) || 0,
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

/** Whether (x, y) is on the table or in the margins its controls stand in (./table.css). */
export const nearTable = (g: TableGeometry, x: number, y: number): boolean =>
  x >= g.left - 2.5 * g.reach && x <= g.right && y >= g.top - 1.5 * g.reach && y <= g.bottom;

/**
 * The line between columns or rows nearest the pointer at (x, y), if it's
 * close enough to show its +: a quarter of a control on the table, half of
 * one in the margin where the + stands, so the pointer can follow the line
 * out to it.
 */
export function nearLine(
  g: TableGeometry,
  x: number,
  y: number,
): { readonly dir: 'column' | 'row'; readonly at: number } | null {
  if (!nearTable(g, x, y)) return null;
  let best: { dir: 'column' | 'row'; at: number; d: number } | null = null;
  const consider = (dir: 'column' | 'row', at: number, d: number, outside: boolean) => {
    if (d <= g.reach / (outside ? 2 : 4) && (!best || d < best.d)) best = { dir, at, d };
  };
  for (let c = 0; c <= g.columns.length; c++)
    if (x >= g.left) consider('column', c, Math.abs(x - columnLine(g, c)), y < g.top);
  for (let at = 0; at < g.rows.length; at++)
    if (y >= g.top) consider('row', at, Math.abs(y - rowLine(g, at)), x < g.left);
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
