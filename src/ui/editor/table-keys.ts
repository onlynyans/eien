// The table editor's keys, in Live with the caret in a table (spec §4,
// Tables): Tab and the arrows between cells, Enter for a new row, Esc out of
// the table; ⌥⌘ arrows add a row or column, ⌥⌘⌫ and ⌥⇧⌘⌫ remove one, ⌥↑ ↓
// move the row; ⇧F10 the cell's menus. Out of a table every key does what it
// does anywhere else.

import { Prec } from '@codemirror/state';
import { type Command, type EditorView, keymap } from '@codemirror/view';
import { atEdge, bodyRowsOf, cellSpan, step } from '../../core/table';
import { caretTable, type TableAt } from './table-at';
import { editTable, tableSay, toCell } from './table-commands';
import { openCellMenu } from './table-menus';

/** A key that only works in a table: `run` gets the caret's table, and says whether it did anything. */
const inTable =
  (run: (view: EditorView, table: TableAt) => boolean): Command =>
  (view) => {
    const table = caretTable(view.state);
    return table ? run(view, table) : false;
  };

/** Where the caret is in its cell's own text, when nothing is selected; null with a selection. */
function caretInCell(view: EditorView, table: TableAt): { cell: string; at: number } | null {
  const { main } = view.state.selection;
  if (!main.empty) return null;
  const span = cellSpan(table.lines, table.here);
  const cell = view.state.doc.sliceString(table.from + span.from, table.from + span.to);
  return { cell, at: main.head - table.from - span.from };
}

const move =
  (key: 'next' | 'previous' | 'up' | 'down' | 'left' | 'right') =>
  (view: EditorView, table: TableAt) => {
    if (key === 'left' || key === 'right') {
      const caret = caretInCell(view, table);
      if (!caret || !atEdge(caret.cell, caret.at, key === 'left' ? 'start' : 'end')) return false;
    }
    const to = step(table.lines, table.here, key);
    if (to === null) return false;
    if (to === 'add') return editTable(view, { kind: 'addRow', at: bodyRowsOf(table.lines), c: 0 });
    toCell(view, table, to.here, to.at);
    return true;
  };

/** Esc: out of the table, to the line after it (a new one, when the table ends the note). */
function leave(view: EditorView, table: TableAt): boolean {
  const { doc } = view.state;
  if (table.to < doc.length) {
    view.dispatch({
      selection: { anchor: table.to + 1 },
      scrollIntoView: true,
      userEvent: 'select',
    });
  } else {
    view.dispatch({
      changes: { from: table.to, insert: '\n' },
      selection: { anchor: table.to + 1 },
      scrollIntoView: true,
      userEvent: 'input',
    });
  }
  return true;
}

const add = (view: EditorView, table: TableAt, side: 'above' | 'below' | 'left' | 'right') => {
  const { r, c } = table.here;
  if (side === 'above') return editTable(view, { kind: 'addRow', at: Math.max(0, r - 1), c });
  if (side === 'below') return editTable(view, { kind: 'addRow', at: r, c });
  return editTable(view, { kind: 'addColumn', at: side === 'left' ? c : c + 1 });
};

/** ⌥↑ ⌥↓: the row moves, as a line does elsewhere; the head row and the delimiter stay put. */
const moveRow = (by: -1 | 1) => (view: EditorView, table: TableAt) => {
  const { r } = table.here;
  const to = r - 1 + by;
  if (r > 0 && to >= 0 && to < bodyRowsOf(table.lines)) editTable(view, { kind: 'moveRow', r, to });
  return true; // never moveLineUp here: it would break the table
};

export const tableKeys = Prec.high(
  keymap.of([
    { key: 'Tab', run: inTable(move('next')), shift: inTable(move('previous')) },
    { key: 'ArrowUp', run: inTable(move('up')) },
    { key: 'ArrowDown', run: inTable(move('down')) },
    { key: 'ArrowLeft', run: inTable(move('left')) },
    { key: 'ArrowRight', run: inTable(move('right')) },
    { key: 'Enter', run: inTable((view, table) => add(view, table, 'below')) },
    {
      key: 'Shift-Enter',
      run: inTable((view) => {
        view.state.facet(tableSay)('A cell is one line in Markdown');
        return true;
      }),
    },
    { key: 'Escape', run: inTable(leave) },
    { key: 'Mod-Alt-ArrowUp', run: inTable((view, table) => add(view, table, 'above')) },
    { key: 'Mod-Alt-ArrowDown', run: inTable((view, table) => add(view, table, 'below')) },
    { key: 'Mod-Alt-ArrowLeft', run: inTable((view, table) => add(view, table, 'left')) },
    { key: 'Mod-Alt-ArrowRight', run: inTable((view, table) => add(view, table, 'right')) },
    {
      key: 'Mod-Alt-Backspace',
      run: inTable((view, table) => editTable(view, { kind: 'removeRow', r: table.here.r })),
      shift: inTable((view, table) => editTable(view, { kind: 'removeColumn', c: table.here.c })),
    },
    { key: 'Alt-ArrowUp', run: inTable(moveRow(-1)) },
    { key: 'Alt-ArrowDown', run: inTable(moveRow(1)) },
    { key: 'Shift-F10', run: inTable((view) => openCellMenu(view)) },
    { key: 'ContextMenu', run: inTable((view) => openCellMenu(view)) },
  ]),
);
