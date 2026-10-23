// The table's controls on the desktop (spec §4, Tables), laid over the
// table under the pointer or the caret: a grip at each row's left and over
// each column, on for the row and column the pointer or caret is in
// (pressed, its menu; dragged, the row or column moves, with the drop
// marker); and a + at the end of a line between two rows or columns, on
// only while the pointer is on that line, the marker showing where the new
// one goes. They're drawn in the page, over the editor (out of its shadow
// root, so they're the window's own controls: ./table.css); with no hover
// (a phone) none of this shows, and the table bar is there instead.

import { Facet } from '@codemirror/state';
import { type EditorView, type PluginValue, ViewPlugin, type ViewUpdate } from '@codemirror/view';
import { cellSpan, type Here } from '../../core/table';
import { caretTable, type TableAt, tableAt } from './table-at';
import { editTable } from './table-commands';
import { type Adding, controlsKey, makeControls, placeControls } from './table-controls';
import { startDrag } from './table-drag';
import { inLayer, measureTable, nearLine, nearTable, type TableGeometry } from './table-geometry';
import { openColumnMenu, openRowMenu } from './table-menus';

/** The layer the controls are drawn in: the editor's own, kept from note to note (its tooltips are watched). */
export const tableToolsHost = Facet.define<HTMLElement, HTMLElement | null>({
  combine: (values) => values[0] ?? null,
});

/** How long the controls stay after the pointer leaves, so it can cross the margin to them. */
const LINGER_MS = 400;

class TableTools implements PluginValue {
  readonly #view: EditorView;
  readonly #host: HTMLElement | null;
  /** The table under the pointer (its start), and the cell the pointer's over. */
  #hover: { pos: number; here: Here | null } | null = null;
  #near: Adding | null = null;
  #linger: ReturnType<typeof setTimeout> | undefined;
  /** What's drawn (./table-controls.ts, controlsKey): made again only when it changes. */
  #built = '';
  #geometry: TableGeometry | null = null;
  #table: TableAt | null = null;
  #dragging = false;

  constructor(view: EditorView) {
    this.#view = view;
    this.#host = view.state.facet(tableToolsHost);
    for (const area of [view.dom, this.#host]) {
      area?.addEventListener('pointermove', this.#moved);
      area?.addEventListener('pointerleave', this.#left);
    }
    this.#host?.addEventListener('pointerdown', this.#pressed);
    this.#host?.addEventListener('mousedown', this.#keepCaret);
    this.#host?.addEventListener('click', this.#clicked);
    this.#schedule();
  }

  update(update: ViewUpdate) {
    if (
      update.docChanged ||
      update.selectionSet ||
      update.geometryChanged ||
      update.viewportChanged
    )
      this.#schedule();
  }

  destroy() {
    clearTimeout(this.#linger);
    for (const area of [this.#view.dom, this.#host]) {
      area?.removeEventListener('pointermove', this.#moved);
      area?.removeEventListener('pointerleave', this.#left);
    }
    this.#host?.removeEventListener('pointerdown', this.#pressed);
    this.#host?.removeEventListener('mousedown', this.#keepCaret);
    this.#host?.removeEventListener('click', this.#clicked);
    this.#host?.replaceChildren();
  }

  #schedule() {
    const host = this.#host;
    if (!host) return;
    this.#view.requestMeasure({
      key: this,
      read: (view) => {
        const hovered = this.#hover ? tableAt(view.state, this.#hover.pos) : null;
        const table = hovered ?? caretTable(view.state);
        return { table, geometry: table ? measureTable(view, table, host) : null };
      },
      write: ({ table, geometry }) => this.#draw(table, geometry),
    });
  }

  readonly #moved = (event: PointerEvent) => {
    if (this.#dragging || event.pointerType !== 'mouse' || !this.#host) return;
    clearTimeout(this.#linger);
    const target = event.target as Element;
    if (this.#host.contains(target)) return; // on a control: what's shown stays
    const pos = target.closest?.('.eien-table-row')
      ? this.#view.posAtCoords({ x: event.clientX, y: event.clientY })
      : null;
    const table = pos === null ? null : tableAt(this.#view.state, pos);
    const g = this.#geometry;
    const p = inLayer(this.#host, event.clientX, event.clientY);
    // Off the rows but by the table (the line above it, where its column grips stand): it stays.
    const hover = table
      ? { pos: table.from, here: table.here }
      : g && nearTable(g, p.x, p.y)
        ? this.#hover
        : null;
    const near = g && hover ? nearLine(g, p.x, p.y) : null;
    const same =
      hover?.pos === this.#hover?.pos &&
      hover?.here?.r === this.#hover?.here?.r &&
      hover?.here?.c === this.#hover?.here?.c &&
      near?.dir === this.#near?.dir &&
      near?.at === this.#near?.at;
    this.#hover = hover;
    this.#near = near;
    if (!same) this.#schedule();
  };

  readonly #left = (event: PointerEvent) => {
    const to = event.relatedTarget as Node | null;
    if (this.#dragging || (to && (this.#view.dom.contains(to) || this.#host?.contains(to)))) return;
    clearTimeout(this.#linger);
    this.#linger = setTimeout(() => {
      this.#hover = null;
      this.#near = null;
      this.#schedule();
    }, LINGER_MS);
  };

  #draw(table: TableAt | null, g: TableGeometry | null) {
    const host = this.#host;
    if (!host || this.#dragging) return;
    this.#table = table;
    this.#geometry = g;
    if (!table || !g) {
      host.replaceChildren();
      this.#built = '';
      return;
    }
    const key = controlsKey(table, g);
    if (key !== this.#built) {
      this.#built = key;
      host.replaceChildren(...makeControls(table, g, (adding) => this.#add(table, adding)));
    }
    const caret = caretTable(this.#view.state);
    placeControls(host, g, {
      near: this.#near,
      hover: this.#hover?.pos === table.from ? this.#hover.here : null,
      caret: caret?.from === table.from ? caret.here : null,
    });
  }

  /** A control's press keeps the caret, and the keyboard, in the note. */
  readonly #keepCaret = (event: MouseEvent) => {
    if ((event.target as Element).closest('button')) event.preventDefault();
  };

  #add(table: TableAt, { dir, at }: Adding) {
    const caret = caretTable(this.#view.state);
    const c = caret?.from === table.from ? caret.here.c : 0;
    editTable(
      this.#view,
      dir === 'column' ? { kind: 'addColumn', at } : { kind: 'addRow', at, c },
      table.from,
    );
    this.#view.focus();
  }

  /** A grip pressed: its menu when it's let go where it was, a move when it's dragged. */
  readonly #pressed = (event: PointerEvent) => {
    const grip = (event.target as Element).closest<HTMLElement>('.table-tools__grip');
    const table = this.#table;
    const g = this.#geometry;
    if (!grip || !table || !g || !this.#host || event.button !== 0) return;
    event.preventDefault();
    const kind = grip.dataset.gripRow ? 'row' : 'column';
    const from = Number(grip.dataset.gripRow ?? grip.dataset.gripColumn);
    this.#dragging = true;
    startDrag({
      event,
      grip,
      layer: this.#host,
      kind,
      from,
      geometry: g,
      moved: (to) => {
        const at = this.#cellPos(table, kind === 'row' ? { r: from, c: 0 } : { r: 0, c: from });
        editTable(
          this.#view,
          kind === 'row' ? { kind: 'moveRow', r: from, to } : { kind: 'moveColumn', c: from, to },
          at,
        );
      },
      pressed: () => this.#menu(grip, table, kind, from),
      ended: () => {
        this.#dragging = false;
        if (grip.getAttribute('aria-expanded') !== 'true') this.#view.focus();
        this.#schedule();
      },
    });
  };

  /** A grip pressed from the keyboard (Enter or Space on it): its menu. */
  readonly #clicked = (event: MouseEvent) => {
    const grip = (event.target as Element).closest<HTMLElement>('.table-tools__grip');
    if (!grip || !this.#table || event.detail !== 0) return;
    const kind = grip.dataset.gripRow ? 'row' : 'column';
    this.#menu(grip, this.#table, kind, Number(grip.dataset.gripRow ?? grip.dataset.gripColumn));
  };

  #menu(grip: HTMLElement, table: TableAt, kind: 'row' | 'column', index: number) {
    grip.setAttribute('aria-expanded', 'true');
    const closed = () => grip.setAttribute('aria-expanded', 'false');
    // Beside a row's grip, under a column's (the menu keeps itself in the window).
    const box = grip.getBoundingClientRect();
    const place = {
      at: kind === 'row' ? { x: box.right, y: box.top } : { x: box.left, y: box.bottom },
    };
    if (kind === 'row') openRowMenu(this.#view, table.from, index, place, closed);
    else openColumnMenu(this.#view, table.from, index, place, closed);
  }

  /** A place in the caret's cell, when the caret's in `table`; else in the cell `fallback`. */
  #cellPos(table: TableAt, fallback: Here): number {
    const { state } = this.#view;
    if (caretTable(state)?.from === table.from) return state.selection.main.head;
    return table.from + cellSpan(table.lines, fallback).from;
  }
}

export const tableTools = ViewPlugin.fromClass(TableTools);
