// The table editor's changes to a table's shape (spec §4, Tables): rows and
// columns added, removed and moved, a column aligned. Each touches only the
// cells it must: a line it doesn't change is written back as it was. What
// can't be done in Markdown is refused, with why: a table always has its head
// row, and at least one column.

import type { TableLine } from './line';
import {
  type Align,
  bodyRowsOf,
  type CaretAt,
  caretIn,
  columnsOf,
  type Here,
  lineOfRow,
  readTable,
  writeTable,
} from './table';

export type TableEdit =
  /** A new row at `at` under the head row (0 is the first); the caret to its cell in column `c`. */
  | { readonly kind: 'addRow'; readonly at: number; readonly c: number }
  | { readonly kind: 'removeRow'; readonly r: number }
  /** A new column at `at` (0 is the first); the caret to its head, to name it. */
  | { readonly kind: 'addColumn'; readonly at: number }
  | { readonly kind: 'removeColumn'; readonly c: number }
  | { readonly kind: 'align'; readonly c: number; readonly align: Align }
  /** Row `r` (never the head row) to stand at `to` among the other rows under the head (0 first). */
  | { readonly kind: 'moveRow'; readonly r: number; readonly to: number }
  /** Column `c` to stand at `to` among the other columns. */
  | { readonly kind: 'moveColumn'; readonly c: number; readonly to: number };

/** Why an edit wasn't made: the head row stays, the last column stays, or it changes nothing. */
export type Refusal = 'head row' | 'last column' | 'nothing';

export type Edited =
  | {
      readonly lines: readonly TableLine[];
      /** Where the caret goes. */
      readonly here: Here;
      readonly at: CaretAt;
      /** It took words away: the writer is told ⌘Z puts them back. */
      readonly lost: boolean;
    }
  | { readonly refused: Refusal };

/** A cell with nothing in it yet; the caret goes between its spaces. */
export const EMPTY_CELL = '  ';
const RULE_CELL = ' --- ';

const hasWords = (cells: readonly (string | undefined)[]) => cells.some((cell) => cell?.trim());
const clamp = (n: number, low: number, high: number) => Math.max(low, Math.min(high, n));

/** Every line with at least `n` cells, as column edits need: a short row gets empty cells. */
function padded(lines: readonly TableLine[], n: number): TableLine[] {
  return lines.map((line, i) =>
    line.cells.length >= n
      ? line
      : {
          ...line,
          cells: [
            ...line.cells,
            ...Array(n - line.cells.length).fill(i === 1 ? RULE_CELL : EMPTY_CELL),
          ],
        },
  );
}

/**
 * The table's lines after a column edit, each with its outer pipes. Without
 * them a cell moved to a row's start could make it something else ("* a" is
 * a list), and an empty cell at either end would be read as the spaces round
 * the row. A column edit rewrites every line, so each is written the safe way.
 */
const piped = (lines: readonly TableLine[]): TableLine[] =>
  lines.map((line) => ({ ...line, open: true, close: true }));

/** A delimiter cell for `align`, keeping its spaces and as many dashes as it had (three at least). */
function ruleFor(cell: string, align: Align): string {
  const before = cell.length - cell.trimStart().length;
  const after = cell.length - cell.trimEnd().length;
  const dashes = Math.max(1, (cell.match(/-/g) ?? []).length);
  const mark =
    align === 'center'
      ? `:${'-'.repeat(dashes)}:`
      : align === 'right'
        ? `${'-'.repeat(Math.max(2, dashes))}:`
        : '-'.repeat(Math.max(3, dashes));
  return `${cell.slice(0, before)}${mark}${cell.slice(cell.length - after)}`;
}

function move<T>(list: readonly T[], from: number, to: number): T[] {
  const out = [...list];
  const [item] = out.splice(from, 1);
  if (item !== undefined) out.splice(to, 0, item);
  return out;
}

/** `edit` made to the table `lines`, the caret at `here`. */
export function editTable(lines: readonly TableLine[], edit: TableEdit, here: Here): Edited {
  const n = columnsOf(lines);
  const rows = bodyRowsOf(lines);
  const head = lines[0];
  if (!head) return { refused: 'nothing' };
  switch (edit.kind) {
    case 'addRow': {
      const at = clamp(edit.at, 0, rows);
      // As the line above it is written: in a quote or a list, the row stays there.
      const above = lines[at + 1] ?? head;
      const open = head.open || !head.close;
      const row: TableLine = {
        lead: above.lead,
        open,
        cells: Array(n).fill(EMPTY_CELL),
        close: head.close || !head.open,
        tail: '',
      };
      const next = [...lines];
      next.splice(at + 2, 0, row);
      return {
        lines: next,
        here: { r: at + 1, c: clamp(edit.c, 0, n - 1) },
        at: 'start',
        lost: false,
      };
    }
    case 'removeRow': {
      if (edit.r === 0) return { refused: 'head row' };
      const index = lineOfRow(edit.r);
      const gone = lines[index];
      if (!gone || edit.r > rows) return { refused: 'nothing' };
      const next = lines.filter((_, i) => i !== index);
      return {
        lines: next,
        here: { r: Math.min(edit.r, rows - 1), c: here.c },
        at: 'end',
        lost: hasWords(gone.cells),
      };
    }
    case 'addColumn': {
      const at = clamp(edit.at, 0, n);
      const next = padded(lines, n).map((line, i) => {
        const cells = [...line.cells];
        cells.splice(at, 0, i === 1 ? RULE_CELL : EMPTY_CELL);
        return { ...line, cells };
      });
      return { lines: piped(next), here: { r: 0, c: at }, at: 'start', lost: false };
    }
    case 'removeColumn': {
      if (n <= 1) return { refused: 'last column' };
      if (edit.c < 0 || edit.c >= n) return { refused: 'nothing' };
      const all = padded(lines, n);
      const lost = hasWords(all.filter((_, i) => i !== 1).map((line) => line.cells[edit.c]));
      const next = all.map((line) => ({
        ...line,
        cells: line.cells.filter((_, c) => c !== edit.c),
      }));
      return {
        lines: piped(next),
        here: { r: here.r, c: Math.min(edit.c, n - 2) },
        at: 'end',
        lost,
      };
    }
    case 'align': {
      const rule = lines[1];
      const cell = rule?.cells[edit.c];
      if (!rule || cell === undefined) return { refused: 'nothing' };
      const written = ruleFor(cell, edit.align);
      if (written === cell) return { refused: 'nothing' };
      const cells = rule.cells.map((each, c) => (c === edit.c ? written : each));
      const next = lines.map((line, i) => (i === 1 ? { ...line, cells } : line));
      return { lines: next, here, at: 'end', lost: false };
    }
    case 'moveRow': {
      const to = clamp(edit.to, 0, rows - 1);
      if (edit.r < 1 || edit.r > rows || to === edit.r - 1) return { refused: 'nothing' };
      // Each line keeps its place's lead; only the cells move.
      const body = move(lines.slice(2), edit.r - 1, to);
      const next = [
        ...lines.slice(0, 2),
        ...body.map((line, i) => ({ ...line, lead: (lines[i + 2] as TableLine).lead })),
      ];
      return { lines: next, here: { r: to + 1, c: here.c }, at: 'end', lost: false };
    }
    case 'moveColumn': {
      const to = clamp(edit.to, 0, n - 1);
      if (edit.c < 0 || edit.c >= n || to === edit.c) return { refused: 'nothing' };
      const next = padded(lines, n).map((line) => ({
        ...line,
        cells: move(line.cells, edit.c, to),
      }));
      return { lines: piped(next), here: { r: here.r, c: to }, at: 'end', lost: false };
    }
  }
}

/** The table `text` changed by `edit`: its new text and caret (places in it), or why it wasn't. */
export function editTableText(
  text: string,
  quoted: boolean,
  edit: TableEdit,
  here: Here,
):
  | {
      readonly text: string;
      readonly caret: { anchor: number; head: number };
      readonly here: Here;
      readonly lost: boolean;
    }
  | { readonly refused: Refusal } {
  const edited = editTable(readTable(text, quoted), edit, here);
  if ('refused' in edited) return edited;
  return {
    text: writeTable(edited.lines),
    caret: caretIn(edited.lines, edited.here, edited.at),
    here: edited.here,
    lost: edited.lost,
  };
}
