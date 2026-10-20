// The selection bar (spec §4): when text is selected, the inline commands
// float just above it. It appears only for a selection the writer made, and
// never while typing.

import { FORMAT_COMMANDS } from '../../core/format';
import { h } from '../dom';
import type { NoteEditor } from './editor';

const SHOW_AFTER_MS = 250;

export class SelectionBar {
  readonly #bar: HTMLElement;
  readonly #editor: NoteEditor;
  #timer: ReturnType<typeof setTimeout> | undefined;

  constructor(container: HTMLElement, editor: NoteEditor) {
    this.#editor = editor;
    const buttons = FORMAT_COMMANDS.filter((command) => command.inBar).map((command) =>
      h('button', {
        class: 'word-button',
        text: command.label,
        attrs: { type: 'button', 'data-command': command.id },
        on: {
          // Keep the editor's focus and selection while the button is pressed.
          mousedown: (event) => event.preventDefault(),
          click: () => {
            editor.format(command);
            this.hide();
          },
        },
      }),
    );
    this.#bar = h('div', { class: 'selection-bar', attrs: { role: 'toolbar', 'aria-label': 'Format', hidden: true } }, ...buttons);
    container.append(this.#bar);

    const dom = editor.view.dom;
    // A selection made with the pointer or the keyboard, then left still.
    dom.addEventListener('mouseup', () => this.#later());
    dom.addEventListener('keyup', (event) => {
      if (event.shiftKey || event.key === 'Shift') this.#later();
      else this.hide();
    });
    dom.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') this.hide();
    });
    dom.addEventListener('input', () => this.hide(), true);
    dom.addEventListener('focusout', () => this.hide());
  }

  hide(): void {
    clearTimeout(this.#timer);
    this.#bar.hidden = true;
  }

  #later(): void {
    clearTimeout(this.#timer);
    this.#timer = setTimeout(() => this.#show(), SHOW_AFTER_MS);
  }

  #show(): void {
    const view = this.#editor.view;
    const { main } = view.state.selection;
    const start = main.empty || view.state.readOnly || !view.hasFocus ? null : view.coordsAtPos(main.from);
    if (!start) {
      this.hide();
      return;
    }
    this.#bar.hidden = false;
    const bar = this.#bar.getBoundingClientRect();
    const top = start.top - bar.height - 8;
    const left = Math.max(8, Math.min(start.left, window.innerWidth - bar.width - 8));
    this.#bar.style.setProperty('--bar-top', `${Math.max(8, top)}px`);
    this.#bar.style.setProperty('--bar-left', `${left}px`);
  }
}
