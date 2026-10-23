// The table's controls on the desktop (spec §4, Tables), laid over the
// table under the pointer or the caret: a grip at each row's left and over
// each column, shown for the row and column the pointer or caret is in
// (pressed, its menu; dragged, the row or column moves, with the drop line);
// and a + at the end of a line between two rows or columns, only while the
// pointer is on that line, with the line showing where the new one goes.
// With no hover (a phone) none of this shows: the table bar is there instead.

import { Facet } from '@codemirror/state';
import { type EditorView, type PluginValue, ViewPlugin, type ViewUpdate } from '@codemirror/view';
import { cellSpan, type Here } from '../../core/table';
import { caretTable, type TableAt, tableAt } from './table-at';
import { editTable } from './table-commands';
import { controlsKey, makeControls, placeControls } from './table-controls';
import { startDrag } from './table-drag';
import { measureTable, nearLine, type TableGeometry } from './table-geometry';
import { openColumnMenu, openRowMenu } from './table-menus';

/** The element the controls are drawn in: the editor's own, kept across notes (its tooltips are watched). */
export const tableToolsHost = Facet.define<HTMLElement, HTMLElement | null>({
  combine: (values) => values[0] ?? null,
});

/** How long the controls stay after the pointer leaves, so it can cross the margin to them. */
const LINGER_MS = 400;

class TableTools implements PluginValue {
  readonly #view: EditorView;
  readonly #host: HTMLElement | null;
  /** A place in the table under the pointer, and the cell it's over. */
  #hover: { pos: number; here: Here | null } | null = null;
  #near: { dir: 'column' | 'row'; at: number } | null = null;
  #linger: ReturnType<typeof setTimeout> | undefined;
  /** What's drawn: the table's start, size and names; drawn again only when they change. */
  #built = '';
  #geometry: TableGeometry | null = null;
  #table: TableAt | null = null;
  #dragging = false;

  constructor(view: EditorView) {
    this.#view = view;
    this.#host = view.state.facet(tableToolsHost);
    view.dom.addEventListener('pointermove', this.#moved);
    view.dom.addEventListener('pointerleave', this.#left);
    this.#host?.addEventListener('pointerdown', this.#pressed);
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
    this.#view.dom.removeEventListener('pointermove', this.#moved);
    this.#view.dom.removeEventListener('pointerleave', this.#left);
    this.#host?.removeEventListener('pointerdown', this.#pressed);
    this.#host?.removeEventListener('click', this.#clicked);
    this.#host?.replaceChildren();
  }

  #schedule() {
    this.#view.requestMeasure({
      key: this,
      read: (view) => {
        const hovered = this.#hover ? tableAt(view.state, this.#hover.pos) : null;
        const table = hovered ?? caretTable(view.state);
        return { table, geometry: table ? measureTable(view, table) : null };
      },
      write: ({ table, geometry }) => this.#draw(table, geometry),
    });
  }

  readonly #moved = (event: PointerEvent) => {
    if (this.#dragging || event.pointerType !== 'mouse') return;
    clearTimeout(this.#linger);
    const target = event.target as Element;
    if (this.#host?.contains(target)) return; // on a control: what's shown stays
    const row = target.closest?.('.eien-table-row');
    const pos = row ? this.#view.posAtCoords({ x: event.clientX, y: event.clientY }) : null;
    const table = pos === null ? null : tableAt(this.#view.state, pos);
    const hover = table && pos !== null ? { pos: table.from, here: table.here } : null;
    // Near a table, but not on a row (the line above it, where its column grips are): it stays.
    const keep = !hover && this.#geometry && this.#nearTable(event);
    const next = keep ? this.#hover : hover;
    const near = this.#geometry && next ? nearLine(this.#geometry, ...this.#local(event)) : null;
    const same =
      next?.pos === this.#hover?.pos &&
      next?.here?.r === this.#hover?.here?.r &&
      next?.here?.c === this.#hover?.here?.c &&
      near?.dir === this.#near?.dir &&
      near?.at === this.#near?.at;
    this.#hover = next;
    this.#near = near;
    if (!same) this.#schedule();
  };

  readonly #left = () => {
    if (this.#dragging) return;
    clearTimeout(this.#linger);
    this.#linger = setTimeout(() => {
      this.#hover = null;
      this.#near = null;
      this.#schedule();
    }, LINGER_MS);
  };

  #local(event: PointerEvent): [number, number] {
    const box = this.#view.dom.getBoundingClientRect();
    return [event.clientX - box.left, event.clientY - box.top];
  }

  #nearTable(event: PointerEvent): boolean {
    const g = this.#geometry;
    if (!g) return false;
    const [x, y] = this.#local(event);
    return x >= g.left - 56 && x <= g.right + 8 && y >= g.top - 28 && y <= g.bottom + 8;
  }

  #draw(table: TableAt | null, g: TableGeometry | null) {
    const host = this.#host;
    if (!host) return;
    this.#table = table;
    this.#geometry = g;
    if (!table || !g) {
      if (!this.#dragging) {
        host.replaceChildren();
        this.#built = '';
      }
      return;
    }
    const key = controlsKey(table, g);
    if (key !== this.#built && !this.#dragging) {
      this.#built = key;
      host.replaceChildren(...makeControls(table, g));
    }
    const caret = caretTable(this.#view.state);
    placeControls(host, g, {
      near: this.#near,
      hover: this.#hover?.pos === table.from ? this.#hover.here : null,
      caret: caret?.from === table.from ? caret.here : null,
    });
  }

  /** A grip pressed: its menu when it's let go where it was, a move when it's dragged. */
  readonly #pressed = (event: PointerEvent) => {
    const target = event.target as Element;
    if (target.closest('.eien-table-add')) {
      event.preventDefault(); // the caret stays where it is
      return;
    }
    const grip = target.closest<HTMLElement>('.eien-table-grip');
    const table = this.#table;
    const g = this.#geometry;
    if (!grip || !table || !g || event.button !== 0) return;
    event.preventDefault();
    const kind = grip.dataset.gripRow ? 'row' : 'column';
    const from = Number(grip.dataset.gripRow ?? grip.dataset.gripColumn);
    const drop = this.#host?.querySelector<HTMLElement>('.eien-table-drop');
    if (!drop) return;
    startDrag({
      view: this.#view,
      event,
      grip,
      drop,
      kind,
      from,
      geometry: g,
      dragging: (on) => {
        this.#dragging = on;
        if (!on) this.#schedule();
      },
      moved: (to) => {
        const at = this.#cellPos(table, kind === 'row' ? { r: from, c: 0 } : { r: 0, c: from });
        editTable(
          this.#view,
          kind === 'row' ? { kind: 'moveRow', r: from, to } : { kind: 'moveColumn', c: from, to },
          at,
        );
        this.#view.focus();
      },
      pressed: () => this.#menu(grip, table, kind, from),
    });
  };

  /** A + clicked, or a grip pressed from the keyboard (Enter or Space on it). */
  readonly #clicked = (event: MouseEvent) => {
    const target = event.target as Element;
    const table = this.#table;
    if (!table) return;
    const add = target.closest<HTMLElement>('.eien-table-add');
    if (add) {
      const caret = caretTable(this.#view.state);
      const c = caret?.from === table.from ? caret.here.c : 0;
      editTable(
        this.#view,
        add.dataset.addColumn !== undefined
          ? { kind: 'addColumn', at: Number(add.dataset.addColumn) }
          : { kind: 'addRow', at: Number(add.dataset.addRow), c },
        table.from,
      );
      this.#view.focus();
      return;
    }
    const grip = target.closest<HTMLElement>('.eien-table-grip');
    if (!grip || event.detail !== 0) return;
    const kind = grip.dataset.gripRow ? 'row' : 'column';
    this.#menu(grip, table, kind, Number(grip.dataset.gripRow ?? grip.dataset.gripColumn));
  };

  #menu(grip: HTMLElement, table: TableAt, kind: 'row' | 'column', index: number) {
    grip.setAttribute('aria-expanded', 'true');
    const closed = () => grip.setAttribute('aria-expanded', 'false');
    const box = grip.getBoundingClientRect();
    const place = {
      at: {
        x: kind === 'row' ? box.right + 4 : box.left,
        y: kind === 'row' ? box.top : box.bottom + 4,
      },
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
