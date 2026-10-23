// The table's tools on a phone (spec §4, Tables): one bar docked at the
// page's foot, above the keyboard, there while the caret is in a table and
// nothing can hover (on the desktop the grips and + are). Rows (above,
// below, remove), columns (left, right, remove), the column's alignment:
// one row of finger-sized buttons that scrolls sideways. A toolbar: one tab
// stop, the arrows along it, Esc back to the cell.

import type { EditorView } from '@codemirror/view';
import { type Align, columnAlign, columnsOf, type TableEdit } from '../../core/table';
import { ariaKeys, keyText } from '../chrome/keys';
import { h } from '../dom';
import { type IconName, icon } from '../icons';
import { caretTable, type TableAt } from './table-at';
import { editTable } from './table-commands';

const MAC = /Mac|iPhone|iPad/.test(navigator.platform);

interface Tool {
  readonly icon: IconName;
  readonly label: string;
  readonly keys?: string;
  readonly edit: (table: TableAt) => TableEdit;
  /** What can't be done says why when pressed, rather than vanishing. */
  readonly off?: (table: TableAt) => boolean;
  readonly align?: Align;
}

const align = (to: Align, icon: IconName, word: string): Tool => ({
  icon,
  label: `Align the column ${word}`,
  align: to,
  edit: ({ here }) => ({ kind: 'align', c: here.c, align: to }),
});

const TOOLS: readonly (Tool | 'rule')[] = [
  {
    icon: 'rowAbove',
    label: 'Add a row above',
    keys: 'Mod-Alt-ArrowUp',
    edit: ({ here }) => ({ kind: 'addRow', at: Math.max(0, here.r - 1), c: here.c }),
  },
  {
    icon: 'rowBelow',
    label: 'Add a row below',
    keys: 'Mod-Alt-ArrowDown',
    edit: ({ here }) => ({ kind: 'addRow', at: here.r, c: here.c }),
  },
  {
    icon: 'rowDelete',
    label: 'Remove this row',
    keys: 'Mod-Alt-Backspace',
    edit: ({ here }) => ({ kind: 'removeRow', r: here.r }),
    off: ({ here }) => here.r === 0,
  },
  'rule',
  {
    icon: 'colLeft',
    label: 'Add a column to the left',
    keys: 'Mod-Alt-ArrowLeft',
    edit: ({ here }) => ({ kind: 'addColumn', at: here.c }),
  },
  {
    icon: 'colRight',
    label: 'Add a column to the right',
    keys: 'Mod-Alt-ArrowRight',
    edit: ({ here }) => ({ kind: 'addColumn', at: here.c + 1 }),
  },
  {
    icon: 'colDelete',
    label: 'Remove this column',
    keys: 'Mod-Alt-Shift-Backspace',
    edit: ({ here }) => ({ kind: 'removeColumn', c: here.c }),
    off: ({ lines }) => columnsOf(lines) === 1,
  },
  'rule',
  align('left', 'alignLeft', 'left'),
  align('center', 'alignCenter', 'centre'),
  align('right', 'alignRight', 'right'),
];

export class TableBar {
  readonly element = h('div', {
    class: 'host table-bar',
    attrs: { role: 'toolbar', 'aria-label': 'Table', hidden: true },
  });
  readonly #view: EditorView;
  readonly #buttons: { button: HTMLButtonElement; tool: Tool }[] = [];
  /** The button the keyboard comes back to: the toolbar's one tab stop. */
  #roving = 0;

  constructor(view: EditorView) {
    this.#view = view;
    for (const tool of TOOLS) {
      if (tool === 'rule') {
        this.element.append(h('span', { class: 'host__rule', attrs: { 'aria-hidden': 'true' } }));
        continue;
      }
      const keys = tool.keys;
      const button = h(
        'button',
        {
          class: 'icon-button',
          attrs: {
            type: 'button',
            tabindex: '-1',
            'aria-label': tool.label,
            'data-tip': tool.label,
            'data-shortcut': keys ? keyText(keys, MAC) : undefined,
            'aria-keyshortcuts': keys ? ariaKeys(keys, MAC) : undefined,
          },
          on: {
            // The finger's press keeps the caret in its cell, and the keyboard up.
            mousedown: (event) => event.preventDefault(),
            click: (event) => this.#press(button, tool, event.detail === 0),
          },
        },
        icon(tool.icon),
      );
      this.#buttons.push({ button, tool });
      this.element.append(button);
    }
    this.element.addEventListener('keydown', (event) => this.#key(event));
    this.element.addEventListener('focusout', () => queueMicrotask(() => this.sync()));
  }

  /** Shown, and each tool as it is now, for where the caret is. */
  sync(): void {
    const table = caretTable(this.#view.state);
    const kept = this.element.contains(document.activeElement);
    this.element.hidden = !table && !kept;
    if (!table) return;
    const now = columnAlign(table.lines, table.here.c);
    for (const [i, { button, tool }] of this.#buttons.entries()) {
      button.tabIndex = i === this.#roving ? 0 : -1;
      if (tool.off) button.setAttribute('aria-disabled', String(tool.off(table)));
      if (tool.align) button.setAttribute('aria-pressed', String(now === tool.align));
    }
  }

  #press(button: HTMLButtonElement, tool: Tool, fromKeyboard: boolean) {
    const table = caretTable(this.#view.state);
    if (!table) return;
    editTable(this.#view, tool.edit(table));
    if (fromKeyboard) {
      this.#roving = this.#buttons.findIndex((each) => each.button === button);
      button.focus();
    } else this.#view.focus();
    this.sync();
  }

  #key(event: KeyboardEvent) {
    const at = this.#buttons.findIndex(({ button }) => button === document.activeElement);
    const last = this.#buttons.length - 1;
    const to = { ArrowRight: at + 1, ArrowLeft: at - 1, Home: 0, End: last }[event.key];
    if (to !== undefined) {
      this.#roving = (to + this.#buttons.length) % this.#buttons.length;
      this.#buttons[this.#roving]?.button.focus();
      this.sync();
    } else if (event.key === 'Escape') this.#view.focus();
    else return;
    event.preventDefault();
  }
}
