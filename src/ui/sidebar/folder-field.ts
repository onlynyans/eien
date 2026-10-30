// Renaming a folder in place: its row's name becomes a field, in the
// section it was asked from (FOLDERS, or SHELF, #40). Enter keeps the name
// typed, Esc doesn't; leaving the field keeps it. What's typed, and where
// the caret is, outlive the sidebar's redraws.

import type { FolderNode } from '../../core/vault';
import { h } from '../dom';
import { atDepth } from './depth';
import type { FolderSection } from './folds';

export interface FolderFieldEvents {
  /** Whether the sidebar is redrawing: a field it takes out isn't the writer leaving. */
  drawing(): boolean;
  /** Done with `folder`, renamed in `section`: `typed` is the name to rename it to, or null to keep its own. */
  done(folder: FolderNode, typed: string | null, section: FolderSection): void;
}

export class FolderField {
  #editing: {
    path: string;
    section: FolderSection;
    typed: string;
    start: number;
    end: number;
  } | null = null;
  readonly #events: FolderFieldEvents;

  constructor(events: FolderFieldEvents) {
    this.#events = events;
  }

  get active(): boolean {
    return this.#editing !== null;
  }

  /** Rename the folder at `path`, in its row in `section`: its whole name is chosen, ready to type over. */
  start(path: string, section: FolderSection): void {
    const name = path.slice(path.lastIndexOf('/') + 1);
    this.#editing = { path, section, typed: name, start: 0, end: name.length };
  }

  /** The field's row, when `folder` is the one being renamed in `section`; else null. */
  row(folder: FolderNode, depth: number, section: FolderSection): HTMLElement | null {
    const editing = this.#editing;
    if (editing?.path !== folder.path || editing.section !== section) return null;
    const field = h('input', {
      class: 'rename tree-row__field',
      attrs: { type: 'text', 'aria-label': `Rename ${folder.name}`, spellcheck: 'false' },
    });
    field.value = editing.typed;
    const finish = (keep: boolean) => {
      if (this.#editing?.path !== folder.path) return;
      this.#editing = null;
      const value = field.value;
      const renaming = keep && value.trim() !== '' && value !== folder.name;
      this.#events.done(folder, renaming ? value : null, section);
    };
    const keep = () => {
      if (!this.#editing) return;
      this.#editing.typed = field.value;
      this.#editing.start = field.selectionStart ?? field.value.length;
      this.#editing.end = field.selectionEnd ?? field.value.length;
    };
    field.addEventListener('input', keep);
    field.addEventListener('select', keep);
    field.addEventListener('keyup', keep);
    field.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') finish(true);
      else if (event.key === 'Escape') finish(false);
      else return;
      event.preventDefault();
      event.stopPropagation();
    });
    // Leaving the field keeps the name; a redraw replacing it, or the window losing
    // focus to another app, isn't leaving it.
    field.addEventListener('blur', () => {
      if (!this.#events.drawing() && field.isConnected && document.hasFocus()) finish(true);
    });
    return atDepth(
      h('li', { class: 'tree-row' }, h('span', { class: 'tree-row__twist' }), field),
      depth,
    );
  }

  /** After a redraw: the caret back in the field, where it was. */
  restore(within: HTMLElement): void {
    const editing = this.#editing;
    const field = within.querySelector<HTMLInputElement>('.tree-row__field');
    if (!editing || !field || document.activeElement === field) return;
    field.focus();
    field.setSelectionRange(editing.start, editing.end);
  }
}
