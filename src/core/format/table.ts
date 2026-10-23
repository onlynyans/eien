// Insert Table: a small GFM table, a header and two rows of two columns, its
// cells empty and the caret in the first. It takes the caret's line when
// that's blank, else goes after it (and after any selection, which stays),
// with a blank line either side so it's read as a table and nothing else.

import type { Edit, Selection } from './edit';

const ROW = '|  |  |';
export const NEW_TABLE = [ROW, '| --- | --- |', ROW, ROW].join('\n');
/** The first cell, between "| " and " |". */
const FIRST_CELL = 2;

const blank = (line: string) => line.trim() === '';

export function insertTable(text: string, selection: Selection): Edit {
  const start = selection.to === 0 ? 0 : text.lastIndexOf('\n', selection.to - 1) + 1;
  const newline = text.indexOf('\n', selection.to);
  const end = newline < 0 ? text.length : newline;
  const nextLine = newline < 0 ? null : text.slice(end + 1, nextEnd(text, end + 1));
  const after = nextLine !== null && !blank(nextLine) ? '\n' : '';
  if (blank(text.slice(start, end))) {
    const previous =
      start === 0 ? '' : text.slice(text.lastIndexOf('\n', start - 2) + 1, start - 1);
    const before = start === 0 || blank(previous) ? '' : '\n';
    const caret = start + before.length + FIRST_CELL;
    return {
      changes: [{ from: start, to: end, insert: `${before}${NEW_TABLE}${after}` }],
      selection: { from: caret, to: caret },
    };
  }
  const caret = end + 2 + FIRST_CELL;
  return {
    changes: [{ from: end, to: end, insert: `\n\n${NEW_TABLE}${after}` }],
    selection: { from: caret, to: caret },
  };
}

function nextEnd(text: string, from: number): number {
  const at = text.indexOf('\n', from);
  return at < 0 ? text.length : at;
}
