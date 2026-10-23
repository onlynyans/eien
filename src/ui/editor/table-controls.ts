// The table's controls on the desktop (./table-tools.ts), made and placed:
// the quiet + (../add-button.ts) on each line between columns and rows, a
// quiet grip for each column and row, and the drop marker (the one your
// order's drag shows) for where a new or moved one goes. Each is named for
// what it does, for a screen reader and the tooltip. Placed by where its
// line, column or row is (`--at-x`, `--at-y`); ./table.css stands each off
// the table by the tokens. Made again only when the table's shape or names
// change.

import { columnName, type Here } from '../../core/table';
import { addButton } from '../add-button';
import { h } from '../dom';
import { icon } from '../icons';
import type { TableAt } from './table-at';
import { columnLine, rowLine, type TableGeometry } from './table-geometry';

/** What a + adds: a column at `at`, or a row at `at` under the head. */
export type Adding = { readonly dir: 'column' | 'row'; readonly at: number };

function addName(table: TableAt, { dir, at }: Adding, n: number, rows: number): string {
  const name = (c: number) => columnName(table.lines, c);
  if (dir === 'column') {
    if (at === 0) return `Add a column before ${name(0)}`;
    if (at === n) return `Add a column after ${name(n - 1)}`;
    return `Add a column between ${name(at - 1)} and ${name(at)}`;
  }
  if (at === 0) return 'Add a row under the head row';
  if (at === rows) return `Add a row after row ${at}`;
  return `Add a row between rows ${at} and ${at + 1}`;
}

function grip(name: string, kind: 'column' | 'row', index: number): HTMLButtonElement {
  return h(
    'button',
    {
      class: `icon-button icon-button--quiet table-tools__grip table-tools__${kind === 'column' ? 'over' : 'beside'}`,
      attrs: {
        type: 'button',
        tabindex: '-1',
        'aria-label': `${name}: menu, or drag to move`,
        'aria-haspopup': 'menu',
        'aria-expanded': 'false',
        'data-tip': `${name}: press for its menu, drag to move`,
        [`data-grip-${kind}`]: String(index),
      },
    },
    icon(kind === 'column' ? 'gripColumn' : 'grip'),
  );
}

const namesOf = (table: TableAt, g: TableGeometry) =>
  g.columns.map((_, c) => columnName(table.lines, c));

/** What the controls are made for: the table's start, its rows and its columns' names. */
export const controlsKey = (table: TableAt, g: TableGeometry): string =>
  `${table.from}/${g.rows.length}/${namesOf(table, g).join('|')}`;

/** The controls for `table`; a + runs `add`. The drop marker comes last. */
export function makeControls(
  table: TableAt,
  g: TableGeometry,
  add: (adding: Adding) => void,
): HTMLElement[] {
  const names = namesOf(table, g);
  const n = names.length;
  const rows = g.rows.length - 1;
  const plus = (adding: Adding) => {
    const button = addButton({
      label: addName(table, adding, n, rows),
      key: `add-${adding.dir}-${adding.at}`,
      run: () => add(adding),
    });
    button.tabIndex = -1;
    button.classList.add(adding.dir === 'column' ? 'table-tools__over' : 'table-tools__beside');
    button.dataset[adding.dir === 'column' ? 'addColumn' : 'addRow'] = String(adding.at);
    return button;
  };
  return [
    ...Array.from({ length: n + 1 }, (_, at) => plus({ dir: 'column', at })),
    ...Array.from({ length: rows + 1 }, (_, at) => plus({ dir: 'row', at })),
    ...names.map((name, c) => grip(`Column ${name}`, 'column', c)),
    ...Array.from({ length: rows }, (_, i) => grip(`Row ${i + 1}`, 'row', i + 1)),
    h('div', { class: 'drop-marker', attrs: { hidden: true } }),
  ];
}

/** What shows: the + on the line the pointer's on, the grips of the pointer's cell and the caret's. */
export interface Shown {
  readonly near: Adding | null;
  readonly hover: Here | null;
  readonly caret: Here | null;
}

const at = (element: HTMLElement, x: number, y: number) => {
  element.style.setProperty('--at-x', `${x}px`);
  element.style.setProperty('--at-y', `${y}px`);
};

/** The drop marker across the table at `y` ('row'), or down it at `x` ('column'); null hides it. */
export function showMarker(
  marker: HTMLElement,
  g: TableGeometry,
  line: Adding | null,
  p = 0,
): void {
  marker.hidden = line === null;
  if (!line) return;
  const across = line.dir === 'column';
  marker.classList.toggle('drop-marker--across', across);
  marker.style.setProperty('--marker-x', `${across ? p : g.left}px`);
  marker.style.setProperty('--marker-y', `${across ? g.top : p}px`);
  marker.style.setProperty('--marker-w', `${g.right - g.left}px`);
  marker.style.setProperty('--marker-h', `${g.bottom - g.top}px`);
}

/** Each control where its line, column or row is; the ones that show, on. */
export function placeControls(host: HTMLElement, g: TableGeometry, shown: Shown): void {
  const { near, hover, caret } = shown;
  for (const element of host.querySelectorAll<HTMLElement>('[data-add-column]')) {
    const c = Number(element.dataset.addColumn);
    at(element, columnLine(g, c), g.top);
    element.classList.toggle('is-on', near?.dir === 'column' && near.at === c);
  }
  for (const element of host.querySelectorAll<HTMLElement>('[data-add-row]')) {
    const r = Number(element.dataset.addRow);
    at(element, g.left, rowLine(g, r));
    element.classList.toggle('is-on', near?.dir === 'row' && near.at === r);
  }
  for (const element of host.querySelectorAll<HTMLElement>('[data-grip-column]')) {
    const c = Number(element.dataset.gripColumn);
    const column = g.columns[c];
    if (column) at(element, column.x + column.w / 2, g.top);
    element.classList.toggle('is-on', hover?.c === c || caret?.c === c);
  }
  for (const element of host.querySelectorAll<HTMLElement>('[data-grip-row]')) {
    const r = Number(element.dataset.gripRow);
    const row = g.rows[r];
    if (row) at(element, g.left, row.y + row.h / 2);
    element.classList.toggle('is-on', hover?.r === r || caret?.r === r);
  }
  const marker = host.querySelector<HTMLElement>('.drop-marker');
  if (marker && !host.classList.contains('is-dragging'))
    showMarker(
      marker,
      g,
      near,
      near?.dir === 'column' ? columnLine(g, near.at) : near ? rowLine(g, near.at) : 0,
    );
}
