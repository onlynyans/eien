// A table's rows, cells and pipes as Live draws them, and each cell as one
// element (the outer decorations), decided on the editor's state alone.

import { EditorState } from '@codemirror/state';
import { describe, expect, it } from 'vitest';
import { NEW_TABLE } from '../../core/format';
import { tableCells, tableRows, tablesIn } from './live-tables';
import { previewMode } from './preview-mode';
import { eienMarkdown } from './syntax';

const stateOf = (doc: string, preview = true) =>
  EditorState.create({
    doc,
    extensions: [eienMarkdown(), ...(preview ? [previewMode.of('live' as const)] : []), tableCells],
  });

/** Each row's kind, cells and pipes, as the text they cover. */
function rowsOf(doc: string) {
  const state = stateOf(doc);
  const [table] = tablesIn(state);
  if (!table) return null;
  const text = ({ from, to }: { from: number; to: number }) => doc.slice(from, to);
  return tableRows(state.doc, table).map((row) => ({
    kind: row.kind,
    cells: row.cells.map(text),
    pipes: row.pipes.map(text),
  }));
}

describe('a table’s rows', () => {
  it('split on the pipes, a cell’s spaces in it, the delimiter row second', () => {
    expect(rowsOf('| Name | Age |\n|---|:-:|\n| Mara | 30 |')).toEqual([
      { kind: 'head', cells: [' Name ', ' Age '], pipes: ['|', '|', '|'] },
      { kind: 'rule', cells: ['---', ':-:'], pipes: ['|', '|', '|'] },
      { kind: 'body', cells: [' Mara ', ' 30 '], pipes: ['|', '|', '|'] },
    ]);
  });

  it('take rows written without the outer pipes, and keep an escaped pipe in its cell', () => {
    expect(rowsOf('a | b\n--|--\nx \\| y | z')).toEqual([
      { kind: 'head', cells: ['a ', ' b'], pipes: ['|'] },
      { kind: 'rule', cells: ['--', '--'], pipes: ['|'] },
      { kind: 'body', cells: ['x \\| y ', ' z'], pipes: ['|'] },
    ]);
  });

  it('give an empty cell its spaces, where the caret goes to fill it', () => {
    expect(rowsOf(NEW_TABLE)).toEqual([
      { kind: 'head', cells: ['  ', '  '], pipes: ['|', '|', '|'] },
      { kind: 'rule', cells: [' --- ', ' --- '], pipes: ['|', '|', '|'] },
      { kind: 'body', cells: ['  ', '  '], pipes: ['|', '|', '|'] },
      { kind: 'body', cells: ['  ', '  '], pipes: ['|', '|', '|'] },
    ]);
  });

  it('leave a quote’s ">" to the quote', () => {
    expect(rowsOf('> | a | b |\n> |---|---|')?.[0]).toEqual({
      kind: 'head',
      cells: [' a ', ' b '],
      pipes: ['|', '|', '|'],
    });
  });

  it('count spaces before a leading pipe and after a trailing one as the pipe’s', () => {
    const rows = rowsOf('  | a | b |  \n|---|---|');
    expect(rows?.[0]).toEqual({ kind: 'head', cells: [' a ', ' b '], pipes: ['  |', '|', '|  '] });
  });
});

describe('a table’s cells', () => {
  const cells = (doc: string, preview = true) => {
    const found: string[] = [];
    stateOf(doc, preview)
      .field(tableCells)
      .between(0, doc.length, (from, to) => void found.push(doc.slice(from, to)));
    return found;
  };

  it('are each one element, wrapping round the marks inside (the outer decorations)', () => {
    expect(cells('| **Project** | due |\n|---|---|\n| a | b |')).toEqual([
      ' **Project** ',
      ' due ',
      '---',
      '---',
      ' a ',
      ' b ',
    ]);
  });

  it('are found in a quote or a list too, and not in Source', () => {
    expect(cells('> | a | b |\n> |---|---|')).not.toEqual([]);
    expect(cells('| a | b |\n|---|---|', false)).toEqual([]);
  });

  it('take their column’s alignment, from its delimiter', () => {
    const doc = '| a | b | c |\n|---|:-:|--:|\n| x | y | 7 |';
    const classes: string[] = [];
    stateOf(doc)
      .field(tableCells)
      .between(0, doc.length, (_from, _to, deco) => void classes.push(String(deco.spec.class)));
    expect(classes.slice(-3)).toEqual([
      'eien-cell',
      'eien-cell eien-cell--center',
      'eien-cell eien-cell--right',
    ]);
  });

  it('follow an edit', () => {
    const state = stateOf('| a | b |\n|---|---|');
    const next = state.update({ changes: { from: 2, insert: 'new ' } }).state;
    const found: string[] = [];
    next.field(tableCells).between(0, next.doc.length, (from, to) => {
      found.push(next.doc.sliceString(from, to));
    });
    expect(found[0]).toBe(' new a ');
  });
});
