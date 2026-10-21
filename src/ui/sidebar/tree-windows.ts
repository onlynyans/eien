// The tree's long lists of notes (two panes, thousands of notes): each drawn
// as one group that shows only the rows in sight (../shell/windowed-rows.ts),
// kept from draw to draw by its list's id, so its scroll and its rows stay.

import { h } from '../dom';
import { type WindowedRow, WindowedRows } from '../shell/windowed-rows';

interface Group {
  readonly rows: WindowedRows;
  readonly holder: HTMLElement;
  readonly depth: number;
}

export class TreeWindows {
  /** The groups drawn last. */
  #shown = new Map<string, Group>();
  /** The groups a draw under way has drawn. */
  #drawing = new Map<string, Group>();

  /** A draw begins: the groups it draws are the ones kept after it. */
  begin(): void {
    this.#drawing = new Map();
  }

  /** The list `id`'s group, the one drawn before if it's at the same depth, given its rows now. */
  readonly group = (id: string, depth: number, rows: readonly WindowedRow[]): HTMLElement => {
    let group = this.#shown.get(id);
    if (!group || group.depth !== depth) {
      const list = h('ul', { class: 'tree tree-window' });
      const estimate =
        parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--eien-row-h')) ||
        30;
      group = {
        rows: new WindowedRows(list, estimate),
        holder: h('li', { class: 'tree-notes' }, list),
        depth,
      };
    }
    this.#drawing.set(id, group);
    group.rows.set(rows);
    return group.holder;
  };

  /** The groups shown before, by id and depth: a draw that patches rows in place asks each again. */
  get shown(): ReadonlyMap<string, { readonly depth: number }> {
    return this.#shown;
  }

  /** The draw is in the window: its groups are the ones kept; each draws the rows in sight. */
  settle(render = true): void {
    this.#shown = this.#drawing;
    if (render) for (const { rows } of this.#shown.values()) rows.render();
  }

  /** Give the keyboard to the note row `key`, drawn or not; false if no group has it. */
  focusKey(key: string): boolean {
    return [...this.#shown.values()].some(({ rows }) => rows.focusKey(key));
  }
}
