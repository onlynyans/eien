// A GFM table as its lines (./line.ts): the head row, the delimiter row under
// it, and the body. Rows are counted as the writer sees them: 0 is the head
// row, 1 the first row under it; the delimiter row is never a row of its own.

import { cellOf, cellStart, readLine, type TableLine, writeLine } from './line';

/** A column's alignment: left (written "---", or ":--"), centre (":-:") or right ("--:"). */
export type Align = 'left' | 'center' | 'right';

/** A cell: its row (0 the head row) and column. */
export interface Here {
  readonly r: number;
  readonly c: number;
}

/** The table `text` (its lines, whole) as lines; `quoted` when it's in a quote. */
export const readTable = (text: string, quoted = false): TableLine[] =>
  text.split('\n').map((line) => readLine(line, quoted));

export const writeTable = (lines: readonly TableLine[]): string => lines.map(writeLine).join('\n');

/** The line row `r` is on. */
export const lineOfRow = (r: number): number => (r === 0 ? 0 : r + 1);

/** How many columns: as many as the head row has cells. */
export const columnsOf = (lines: readonly TableLine[]): number => lines[0]?.cells.length ?? 0;

/** How many rows under the head row. */
export const bodyRowsOf = (lines: readonly TableLine[]): number => Math.max(0, lines.length - 2);

/** A delimiter cell's alignment. */
export function alignOf(rule: string): Align {
  const mark = rule.trim();
  const right = mark.endsWith(':');
  if (right) return mark.startsWith(':') ? 'center' : 'right';
  return 'left';
}

/** Column `c`'s alignment. */
export const columnAlign = (lines: readonly TableLine[], c: number): Align =>
  alignOf(lines[1]?.cells[c] ?? '');

/** A cell's words as the writer reads them: no spaces round them. */
export const cellWords = (lines: readonly TableLine[], { r, c }: Here): string =>
  lines[lineOfRow(r)]?.cells[c]?.trim() ?? '';

/** The cell at `at`, a place in the table's text. On the delimiter row, the head row's. */
export function hereAt(lines: readonly TableLine[], at: number): Here {
  let start = 0;
  for (const [i, line] of lines.entries()) {
    const length = writeLine(line).length;
    if (at <= start + length || i === lines.length - 1) {
      const c = Math.min(cellOf(line, at - start), columnsOf(lines) - 1);
      return { r: i <= 1 ? 0 : i - 1, c: Math.max(0, c) };
    }
    start += length + 1;
  }
  return { r: 0, c: 0 };
}

/** Where a cell is in the table's text, from its first character to its last (its spaces in it). */
export function cellSpan(
  lines: readonly TableLine[],
  { r, c }: Here,
): { from: number; to: number } {
  const index = lineOfRow(r);
  let start = 0;
  for (let i = 0; i < index; i++) start += writeLine(lines[i] as TableLine).length + 1;
  const line = lines[index];
  if (!line) return { from: start, to: start };
  const from = start + cellStart(line, c);
  return { from, to: from + (line.cells[c]?.length ?? 0) };
}

/** Where the caret goes in a cell: before its words, after them, or round them all. */
export type CaretAt = 'start' | 'end' | 'all';

/** The words' bounds in `cell`; an empty cell's caret goes after its first space, as typed. */
export function wordsIn(cell: string): { from: number; to: number } {
  const from = cell.length - cell.trimStart().length;
  if (from === cell.length) {
    const middle = Math.min(1, cell.length);
    return { from: middle, to: middle };
  }
  return { from, to: cell.trimEnd().length };
}

/** The caret for `at` in a cell at `span` of the table's text. */
export function caretIn(
  lines: readonly TableLine[],
  here: Here,
  at: CaretAt,
): { anchor: number; head: number } {
  const span = cellSpan(lines, here);
  const cell = lines[lineOfRow(here.r)]?.cells[here.c] ?? '';
  const words = wordsIn(cell);
  const from = span.from + words.from;
  const to = span.from + words.to;
  if (at === 'start') return { anchor: from, head: from };
  if (at === 'end') return { anchor: to, head: to };
  return { anchor: from, head: to };
}

/** Whether `at` (in the cell's own text) is at or before its words ('start'), or at or after them ('end'). */
export function atEdge(cell: string, at: number, side: 'start' | 'end'): boolean {
  const words = wordsIn(cell);
  return side === 'start' ? at <= words.from : at >= words.to;
}

/** A column's name, for the colophon and the menus: its head, or "column 2" with none. */
export function columnName(lines: readonly TableLine[], c: number): string {
  return cellWords(lines, { r: 0, c }) || `column ${c + 1}`;
}

/** Where a key takes the caret from `here`; 'add' for a new row (Tab in the last cell), null to leave it be. */
export function step(
  lines: readonly TableLine[],
  { r, c }: Here,
  key: 'next' | 'previous' | 'up' | 'down' | 'left' | 'right',
): { here: Here; at: CaretAt } | 'add' | null {
  const n = columnsOf(lines);
  const last = bodyRowsOf(lines);
  switch (key) {
    case 'next':
      if (c < n - 1) return { here: { r, c: c + 1 }, at: 'all' };
      return r < last ? { here: { r: r + 1, c: 0 }, at: 'all' } : 'add';
    case 'previous':
      if (c > 0) return { here: { r, c: c - 1 }, at: 'all' };
      return r > 0 ? { here: { r: r - 1, c: n - 1 }, at: 'all' } : { here: { r, c }, at: 'all' };
    case 'up':
      return r > 0 ? { here: { r: r - 1, c }, at: 'end' } : null;
    case 'down':
      return r < last ? { here: { r: r + 1, c }, at: 'end' } : null;
    case 'left':
      if (c > 0) return { here: { r, c: c - 1 }, at: 'end' };
      return r > 0 ? { here: { r: r - 1, c: n - 1 }, at: 'end' } : null;
    case 'right':
      if (c < n - 1) return { here: { r, c: c + 1 }, at: 'start' };
      return r < last ? { here: { r: r + 1, c: 0 }, at: 'start' } : null;
  }
}
