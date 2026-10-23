// A table's menus (spec §4, Tables), in the row menu's style (ui/menu): a
// row's (its grip), a column's (its grip: with its alignment, a dot by the
// one it has), or a cell's, both at once (a right-click, ⇧F10, a long press,
// or the formatting bar's Table button). Removing comes last, in carmine.

import { EditorView } from '@codemirror/view';
import {
  type Align,
  bodyRowsOf,
  cellSpan,
  columnAlign,
  columnName,
  columnsOf,
  type Here,
  type TableEdit,
} from '../../core/table';
import type { IconName } from '../icons';
import { type MenuItem, openMenu, type Place } from '../menu/menu';
import { caretTable, type TableAt, tableAt } from './table-at';
import { editTable } from './table-commands';

const ALIGNS: readonly { align: Align; word: string; icon: IconName }[] = [
  { align: 'left', word: 'Align left', icon: 'alignLeft' },
  { align: 'center', word: 'Align centre', icon: 'alignCenter' },
  { align: 'right', word: 'Align right', icon: 'alignRight' },
];

/** Runs `edit` on the table, its caret in the cell `here` while it does. */
function runner(view: EditorView, table: TableAt, here: Here) {
  const at = table.from + cellSpan(table.lines, here).from;
  return (edit: TableEdit) => () => {
    editTable(view, edit, at);
    view.focus();
  };
}

function rowItems(view: EditorView, table: TableAt, here: Here): MenuItem[] {
  const run = runner(view, table, here);
  const { r, c } = here;
  if (r === 0)
    return [
      {
        label: 'Add a row below',
        icon: 'rowBelow',
        keys: 'Mod-Alt-ArrowDown',
        run: run({ kind: 'addRow', at: 0, c }),
      },
    ];
  const last = bodyRowsOf(table.lines);
  return [
    {
      label: 'Add a row above',
      icon: 'rowAbove',
      keys: 'Mod-Alt-ArrowUp',
      run: run({ kind: 'addRow', at: r - 1, c }),
    },
    {
      label: 'Add a row below',
      icon: 'rowBelow',
      keys: 'Mod-Alt-ArrowDown',
      run: run({ kind: 'addRow', at: r, c }),
    },
    {
      label: 'Move up',
      icon: 'up',
      keys: 'Alt-ArrowUp',
      disabled: r === 1,
      run: run({ kind: 'moveRow', r, to: r - 2 }),
    },
    {
      label: 'Move down',
      icon: 'down',
      keys: 'Alt-ArrowDown',
      disabled: r === last,
      run: run({ kind: 'moveRow', r, to: r }),
    },
  ];
}

function columnItems(view: EditorView, table: TableAt, here: Here): MenuItem[] {
  const run = runner(view, table, here);
  const { c } = here;
  const now = columnAlign(table.lines, c);
  return [
    {
      label: 'Add a column left',
      icon: 'colLeft',
      keys: 'Mod-Alt-ArrowLeft',
      run: run({ kind: 'addColumn', at: c }),
    },
    {
      label: 'Add a column right',
      icon: 'colRight',
      keys: 'Mod-Alt-ArrowRight',
      run: run({ kind: 'addColumn', at: c + 1 }),
    },
    'separator',
    ...ALIGNS.map(
      ({ align, word, icon }): MenuItem => ({
        label: word,
        icon,
        checked: now === align,
        run: run({ kind: 'align', c, align }),
      }),
    ),
    'separator',
    {
      label: 'Move left',
      icon: 'left',
      disabled: c === 0,
      run: run({ kind: 'moveColumn', c, to: c - 1 }),
    },
    {
      label: 'Move right',
      icon: 'right',
      disabled: c === columnsOf(table.lines) - 1,
      run: run({ kind: 'moveColumn', c, to: c + 1 }),
    },
  ];
}

const removeRow = (view: EditorView, table: TableAt, here: Here): MenuItem => ({
  label: 'Remove row',
  icon: 'trash',
  keys: 'Mod-Alt-Backspace',
  danger: true,
  run: runner(view, table, here)({ kind: 'removeRow', r: here.r }),
});

const removeColumn = (view: EditorView, table: TableAt, here: Here): MenuItem => ({
  label: 'Remove column',
  icon: 'trash',
  keys: 'Mod-Alt-Shift-Backspace',
  danger: true,
  disabled: columnsOf(table.lines) === 1,
  run: runner(view, table, here)({ kind: 'removeColumn', c: here.c }),
});

const rowName = (r: number) => (r === 0 ? 'The head row' : `Row ${r}`);

/** The menu of row `r` of the table at `pos`, under its grip. */
export function openRowMenu(
  view: EditorView,
  pos: number,
  r: number,
  place: Place,
  closed?: () => void,
): void {
  const table = tableAt(view.state, pos);
  if (!table) return;
  const here = { r, c: table.here.r === r ? table.here.c : 0 };
  const items = [
    ...rowItems(view, table, here),
    ...(r > 0 ? (['separator', removeRow(view, table, here)] as const) : []),
  ];
  openMenu(items, place, rowName(r), true, closed);
}

/** The menu of column `c` of the table at `pos`, under its grip. */
export function openColumnMenu(
  view: EditorView,
  pos: number,
  c: number,
  place: Place,
  closed?: () => void,
): void {
  const table = tableAt(view.state, pos);
  if (!table) return;
  const here = { r: table.here.c === c ? table.here.r : 0, c };
  const items = [
    ...columnItems(view, table, here),
    'separator' as const,
    removeColumn(view, table, here),
  ];
  openMenu(items, place, `Column · ${columnName(table.lines, c)}`, true, closed);
}

/**
 * The caret's cell's menus, its row's and its column's, at `at` (the
 * pointer) or under the caret. False with the caret in no table.
 */
export function openCellMenu(view: EditorView, at?: { x: number; y: number }): boolean {
  const table = caretTable(view.state);
  if (!table) return false;
  const { here } = table;
  const caret = view.coordsAtPos(view.state.selection.main.head);
  const place = { at: at ?? { x: caret?.left ?? 0, y: (caret?.bottom ?? 0) + 4 } };
  const removals = [
    ...(here.r > 0 ? [removeRow(view, table, here)] : []),
    removeColumn(view, table, here),
  ];
  const items: MenuItem[] = [
    ...rowItems(view, table, here),
    'separator',
    ...columnItems(view, table, here),
    'separator',
    ...removals,
  ];
  openMenu(
    items,
    place,
    `${here.r === 0 ? 'Head' : `Row ${here.r}`} · ${columnName(table.lines, here.c)}`,
    true,
  );
  return true;
}

/** A right-click on a cell (a long press, where the phone gives one): the caret goes there, and both its menus open. */
export const cellContextMenu = EditorView.domEventHandlers({
  contextmenu(event, view) {
    const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
    if (pos === null || !tableAt(view.state, pos) || view.state.readOnly) return false;
    event.preventDefault();
    view.dispatch({ selection: { anchor: pos }, userEvent: 'select.pointer' });
    return openCellMenu(view, { x: event.clientX, y: event.clientY });
  },
});
