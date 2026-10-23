// The table editor's changes, made on the note (spec §4, Tables): each is
// one transaction and one step of the editor's history, so ⌘Z puts back what
// it took; and each says what it did in the colophon, a removal that took
// words with how to get them back.

import { isolateHistory } from '@codemirror/commands';
import { EditorSelection, Facet } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import {
  type CaretAt,
  caretIn,
  columnName,
  editTableText,
  type Here,
  type Refusal,
  type TableEdit,
} from '../../core/table';
import { keyText } from '../chrome/keys';
import { caretTable, type TableAt, tableAt } from './table-at';

const MAC = /Mac|iPhone|iPad/.test(navigator.platform);

/** Where the table editor says what it did: the colophon (ui/page). */
export const tableSay = Facet.define<(words: string) => void, (words: string) => void>({
  combine: (values) => values[0] ?? (() => {}),
});

const REFUSED: Record<Refusal, string | null> = {
  'head row': 'The head row stays: a Markdown table always has one',
  'last column': 'The last column stays: delete the table in Source',
  nothing: null,
};

const ALIGNED = { left: 'left', center: 'centre', right: 'right' } as const;

/** What the colophon says of `edit`, made to the table `lines`. */
function saidOf(table: TableAt, edit: TableEdit, lost: boolean): string {
  const back = lost ? ` · ${keyText('Mod-z', MAC)} puts it back` : '';
  switch (edit.kind) {
    case 'addRow':
      return 'Row added';
    case 'removeRow':
      return `Row ${edit.r} removed${back}`;
    case 'addColumn':
      return 'Column added: name it';
    case 'removeColumn':
      return `Column ${columnName(table.lines, edit.c)} removed${back}`;
    case 'align':
      return `${columnName(table.lines, edit.c)} aligned ${ALIGNED[edit.align]}`;
    case 'moveRow':
      return `Row ${edit.r} moved`;
    case 'moveColumn':
      return `${columnName(table.lines, edit.c)} moved`;
  }
}

/**
 * Make `edit` to the table at `at` (the caret's, by default). True when there
 * was a table there to change, made or refused (and the refusal said).
 */
export function editTable(view: EditorView, edit: TableEdit, at?: number): boolean {
  const { state } = view;
  if (state.readOnly) return false;
  const table = at === undefined ? caretTable(state) : tableAt(state, at);
  if (!table) return false;
  const text = state.doc.sliceString(table.from, table.to);
  const out = editTableText(text, table.quoted, edit, table.here);
  const say = state.facet(tableSay);
  if ('refused' in out) {
    const words = REFUSED[out.refused];
    if (words) say(words);
    return true;
  }
  // Only what differs is changed: the rest of the table, and anything marked in it, stays put.
  let start = 0;
  while (start < text.length && text[start] === out.text[start]) start++;
  let end = 0;
  while (
    end < text.length - start &&
    end < out.text.length - start &&
    text[text.length - 1 - end] === out.text[out.text.length - 1 - end]
  )
    end++;
  view.dispatch({
    changes: {
      from: table.from + start,
      to: table.to - end,
      insert: out.text.slice(start, out.text.length - end),
    },
    selection: EditorSelection.range(table.from + out.caret.anchor, table.from + out.caret.head),
    annotations: isolateHistory.of('full'),
    userEvent: 'input.table',
    scrollIntoView: true,
  });
  say(saidOf(table, edit, out.lost));
  return true;
}

/** Put the caret in a cell of `table`, as it is now: before its words, after them, or round them. */
export function toCell(view: EditorView, table: TableAt, here: Here, at: CaretAt): void {
  const caret = caretIn(table.lines, here, at);
  view.dispatch({
    selection: EditorSelection.range(table.from + caret.anchor, table.from + caret.head),
    scrollIntoView: true,
    userEvent: 'select',
  });
}
