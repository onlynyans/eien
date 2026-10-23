// Typing in a table's cell in Live keeps the table whole (spec §4, Tables):
// what's typed or pasted goes in as one line, its "|" saved as "\|"
// (core/table's cellInput); and Backspace or Delete, with nothing selected,
// never takes a cell's edge or the break between two rows. A selection the
// writer deletes goes, whatever it holds: ⌘Z puts it back.

import { EditorState, Transaction, type TransactionSpec } from '@codemirror/state';
import { cellInput, mayCrossCells, pipesIn } from '../../core/table';
import { tableAt } from './table-at';

/** The one change `tr` makes, or null for none or several. */
function onlyChange(tr: Transaction) {
  let only: { fromA: number; toA: number; inserted: string } | null = null;
  let count = 0;
  tr.changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => {
    count++;
    only = { fromA, toA, inserted: inserted.toString() };
  });
  return count === 1 ? (only as { fromA: number; toA: number; inserted: string } | null) : null;
}

/** Whether the line `pos` is on is a row of a table: not its delimiter row. */
function inRow(state: EditorState, pos: number): boolean {
  const table = tableAt(state, pos);
  return table !== null && state.doc.lineAt(pos).from !== state.doc.lineAt(table.from).to + 1;
}

function typed(tr: Transaction): TransactionSpec {
  const change = onlyChange(tr);
  if (!change || !mayCrossCells(change.inserted)) return tr;
  const state = tr.startState;
  const line = state.doc.lineAt(change.fromA);
  if (change.toA > line.to || !inRow(state, change.fromA)) return tr;
  const insert = cellInput(
    line.text.slice(0, change.fromA - line.from),
    change.inserted,
    line.text.slice(change.toA - line.from),
  );
  if (insert === change.inserted) return tr;
  const userEvent = tr.annotation(Transaction.userEvent);
  return {
    changes: { from: change.fromA, to: change.toA, insert },
    selection: { anchor: change.fromA + insert.length },
    ...(userEvent ? { userEvent } : {}),
    scrollIntoView: true,
  };
}

function deleted(tr: Transaction): TransactionSpec | readonly TransactionSpec[] {
  const change = onlyChange(tr);
  if (change?.inserted !== '') return tr;
  const state = tr.startState;
  const gone = state.doc.sliceString(change.fromA, change.toA);
  if (!/[|\\\n]/u.test(gone)) return tr;
  const line = state.doc.lineAt(change.fromA);
  if (gone.includes('\n')) {
    // Words joined onto a row would be its last cell's; a blank line may go.
    const before = line.text.slice(0, change.fromA - line.from);
    const last = state.doc.lineAt(change.toA);
    const after = last.text.slice(change.toA - last.from);
    const joins = before.trim() !== '' && after.trim() !== '';
    const table = tableAt(state, change.fromA) ?? tableAt(state, change.toA);
    return joins && table ? [] : tr;
  }
  if (!inRow(state, change.fromA)) return tr;
  const after =
    line.text.slice(0, change.fromA - line.from) + line.text.slice(change.toA - line.from);
  return pipesIn(after).length === pipesIn(line.text).length ? tr : [];
}

export const tableInput = EditorState.transactionFilter.of((tr) => {
  if (!tr.docChanged) return tr;
  if (tr.isUserEvent('input.type') || tr.isUserEvent('input.paste')) return typed(tr);
  if (tr.isUserEvent('delete') && tr.startState.selection.main.empty) return deleted(tr);
  return tr;
});
