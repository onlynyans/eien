// The table's controls on the desktop (./table-tools.ts), made and placed:
// a + on each line between columns and rows, a grip for each column and row,
// and the drop line; each named for what it does, for a screen reader and the
// tooltip. Made again only when the table's shape or names change.

import { columnName, type Here } from '../../core/table';
import { h } from '../dom';
import { type IconName, icon } from '../icons';
import type { TableAt } from './table-at';
import { columnLine, rowLine, type TableGeometry } from './table-geometry';

const control = (
  cls: string,
  name: IconName,
  label: string,
  tip: string,
  data: Record<string, string>,
) =>
  h(
    'button',
    {
      class: cls,
      attrs: { type: 'button', tabindex: '-1', 'aria-label': label, 'data-tip': tip, ...data },
    },
    icon(name),
  );

function insertName(
  table: TableAt,
  dir: 'column' | 'row',
  at: number,
  n: number,
  rows: number,
): string {
  if (dir === 'column') {
    if (at === 0) return `Add a column before ${columnName(table.lines, 0)}`;
    if (at === n) return `Add a column after ${columnName(table.lines, n - 1)}`;
    return `Add a column between ${columnName(table.lines, at - 1)} and ${columnName(table.lines, at)}`;
  }
  if (at === 0) return 'Add a row under the head row';
  if (at === rows) return `Add a row after row ${at}`;
  return `Add a row between rows ${at} and ${at + 1}`;
}

const namesOf = (table: TableAt, g: TableGeometry) =>
  g.columns.map((_, c) => columnName(table.lines, c));

/** What the controls are made for: the table's start, its rows and its columns' names. */
export const controlsKey = (table: TableAt, g: TableGeometry): string =>
  `${table.from}/${g.rows.length}/${namesOf(table, g).join('|')}`;

/** The controls for `table`, and the drop line last. */
export function makeControls(table: TableAt, g: TableGeometry): HTMLElement[] {
  const names = namesOf(table, g);
  const n = names.length;
  const rows = g.rows.length - 1;
  const parts: HTMLElement[] = [];
  for (let c = 0; c <= n; c++)
    parts.push(
      control(
        'eien-table-add eien-table-add--column',
        'plus',
        insertName(table, 'column', c, n, rows),
        'Add a column',
        { 'data-add-column': String(c) },
      ),
    );
  for (let at = 0; at <= rows; at++)
    parts.push(
      control(
        'eien-table-add eien-table-add--row',
        'plus',
        insertName(table, 'row', at, n, rows),
        'Add a row',
        { 'data-add-row': String(at) },
      ),
    );
  for (const [c, name] of names.entries())
    parts.push(
      control(
        'eien-table-grip eien-table-grip--column',
        'gripColumn',
        `Column ${name}: menu, or drag to move`,
        `Column ${name}: press for its menu, drag to move`,
        { 'data-grip-column': String(c), 'aria-haspopup': 'menu', 'aria-expanded': 'false' },
      ),
    );
  for (let r = 1; r <= rows; r++)
    parts.push(
      control(
        'eien-table-grip eien-table-grip--row',
        'grip',
        `Row ${r}: menu, or drag to move`,
        `Row ${r}: press for its menu, drag to move`,
        { 'data-grip-row': String(r), 'aria-haspopup': 'menu', 'aria-expanded': 'false' },
      ),
    );
  return [...parts, h('div', { class: 'eien-table-drop' })];
}

/** What shows: the + on the line the pointer's on, the grips of the pointer's cell and the caret's. */
export interface Shown {
  readonly near: { readonly dir: 'column' | 'row'; readonly at: number } | null;
  readonly hover: Here | null;
  readonly caret: Here | null;
}

/** Each control where its line, column or row is, in the editor's box; the ones that show, shown. */
export function placeControls(host: HTMLElement, g: TableGeometry, shown: Shown): void {
  host.style.setProperty('--table-width', `${g.right - g.left}px`);
  host.style.setProperty('--table-height', `${g.bottom - g.top}px`);
  const place = (element: HTMLElement, x: number, y: number) => {
    element.style.left = `${x}px`;
    element.style.top = `${y}px`;
  };
  const { near, hover, caret } = shown;
  for (const element of host.querySelectorAll<HTMLElement>('[data-add-column]')) {
    const c = Number(element.dataset.addColumn);
    place(element, columnLine(g, c), g.top - 14);
    element.classList.toggle('is-near', near?.dir === 'column' && near.at === c);
  }
  for (const element of host.querySelectorAll<HTMLElement>('[data-add-row]')) {
    const at = Number(element.dataset.addRow);
    place(element, g.left - 40, rowLine(g, at));
    element.classList.toggle('is-near', near?.dir === 'row' && near.at === at);
  }
  for (const element of host.querySelectorAll<HTMLElement>('[data-grip-column]')) {
    const c = Number(element.dataset.gripColumn);
    const column = g.columns[c];
    if (column) place(element, column.x + column.w / 2, g.top - 14);
    element.classList.toggle('is-shown', hover?.c === c || caret?.c === c);
  }
  for (const element of host.querySelectorAll<HTMLElement>('[data-grip-row]')) {
    const r = Number(element.dataset.gripRow);
    const row = g.rows[r];
    if (row) place(element, g.left - 16, row.y + row.h / 2);
    element.classList.toggle('is-shown', hover?.r === r || caret?.r === r);
  }
}
