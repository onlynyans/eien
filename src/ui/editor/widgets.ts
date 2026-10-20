// What Live and Reading draw in place of Markdown: a checkbox, a scene
// break, an image, a table.

import { Facet } from '@codemirror/state';
import { type EditorView, WidgetType } from '@codemirror/view';
import { toggleCheck } from '../../core/format';

/** Loads an image a note refers to, as a URL the page may show; null if it can't. */
export type ImageLoader = (src: string) => Promise<string | null>;

export const imageLoader = Facet.define<ImageLoader, ImageLoader>({
  combine: (values) => values[0] ?? (async () => null),
});

/** "- [ ]" as a box to tick. Ticking changes the text, so undo undoes it. */
export class CheckboxWidget extends WidgetType {
  constructor(readonly done: boolean) {
    super();
  }
  override eq(other: CheckboxWidget) {
    return other.done === this.done;
  }
  toDOM(view: EditorView) {
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.className = 'eien-check';
    box.checked = this.done;
    box.setAttribute('aria-label', this.done ? 'Done' : 'Not done');
    box.addEventListener('mousedown', (event) => {
      event.preventDefault(); // keep the caret where it was
      if (view.state.readOnly) return;
      const edit = toggleCheck(view.state.doc.toString(), view.posAtDOM(box));
      if (edit) view.dispatch({ changes: [...edit.changes] });
    });
    return box;
  }
  override ignoreEvent() {
    return false;
  }
}

/** "***": a scene break, three spaced stars. */
export class SceneBreakWidget extends WidgetType {
  override eq() {
    return true;
  }
  toDOM() {
    const span = document.createElement('span');
    span.className = 'eien-scene-break';
    span.textContent = '* * *';
    span.setAttribute('role', 'separator');
    return span;
  }
}

/** ![alt](src): the picture, loaded through the vault; a quiet note when it can't be. */
export class ImageWidget extends WidgetType {
  constructor(
    readonly src: string,
    readonly alt: string,
  ) {
    super();
  }
  override eq(other: ImageWidget) {
    return other.src === this.src && other.alt === this.alt;
  }
  toDOM(view: EditorView) {
    const holder = document.createElement('span');
    const note = (text: string) => {
      holder.className = 'eien-image-note';
      holder.textContent = text;
    };
    if (/^[a-z][a-z0-9+.-]*:/i.test(this.src) && !/^data:/i.test(this.src)) {
      note(`[Image from ${this.src} — not loaded: Eien never fetches from the web]`);
      return holder;
    }
    note(`[${this.alt || 'Image'}]`);
    void view.state.facet(imageLoader)(this.src).then((url) => {
      if (!url) {
        note(`[Image not found: ${this.src}]`);
        return;
      }
      const image = document.createElement('img');
      image.className = 'eien-image';
      image.alt = this.alt;
      image.src = url;
      holder.className = '';
      holder.replaceChildren(image);
    });
    return holder;
  }
}

/** A Markdown table, drawn as one. Its cells show their text as written. */
export class TableWidget extends WidgetType {
  constructor(readonly source: string) {
    super();
  }
  override eq(other: TableWidget) {
    return other.source === this.source;
  }
  toDOM() {
    const rows = this.source
      .split('\n')
      .filter((row) => row.trim() !== '')
      .map(cellsOf);
    const table = document.createElement('table');
    table.className = 'eien-table';
    rows.forEach((cells, index) => {
      if (index === 1 && cells.every((cell) => /^:?-+:?$/.test(cell))) return; // the delimiter row
      const tr = table.insertRow();
      for (const text of cells) {
        const cell = document.createElement(index === 0 ? 'th' : 'td');
        cell.textContent = text;
        tr.append(cell);
      }
    });
    return table;
  }
}

/** A table row's cells: split on "|" (not "\|"), the outer pipes optional. */
function cellsOf(row: string): string[] {
  const trimmed = row.trim().replace(/^\|/, '').replace(/(?<!\\)\|$/, '');
  return trimmed.split(/(?<!\\)\|/).map((cell) => cell.trim().replace(/\\\|/g, '|'));
}
