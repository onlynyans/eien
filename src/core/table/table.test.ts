// A table's lines read and written back as they were, and the cells, rows
// and keys the table editor works with.

import { describe, expect, it } from 'vitest';
import {
  alignOf,
  atEdge,
  caretIn,
  cellInput,
  cellSpan,
  columnName,
  escapePipes,
  hereAt,
  oneLine,
  readLine,
  readTable,
  step,
  wordsIn,
  writeLine,
} from './index';

const TABLE = ['| Name | Age |', '|---|--:|', '| Mara | 30 |', '| Levi |  |'].join('\n');

describe('a table’s line', () => {
  it('splits on its pipes, each cell with its spaces', () => {
    expect(readLine('| a | b |')).toEqual({
      lead: '',
      open: true,
      cells: [' a ', ' b '],
      close: true,
      tail: '',
    });
  });

  it('takes a row written without its outer pipes, and keeps an escaped pipe in its cell', () => {
    expect(readLine('a | b \\| c')).toMatchObject({
      open: false,
      cells: ['a ', ' b \\| c'],
      close: false,
    });
    expect(readLine('a |')).toMatchObject({ open: false, cells: ['a '], close: true });
    expect(readLine('| a')).toMatchObject({ open: true, cells: [' a'], close: false });
  });

  it('leaves a quote’s ">" and a list’s indent to what’s round the row', () => {
    expect(readLine('> | a | b |', true)).toMatchObject({ lead: '> ', cells: [' a ', ' b '] });
    expect(readLine('   | a |  ')).toMatchObject({ lead: '   ', cells: [' a '], tail: '  ' });
  });

  it('is written back as it was', () => {
    for (const line of ['| a | b |', 'a|b', '|a|', ' | x \\| | y |   ', '> |a|b', '|', 'a \\\\| b'])
      expect(writeLine(readLine(line, line.startsWith('>')))).toBe(line);
  });
});

describe('a table’s cells', () => {
  const lines = readTable(TABLE);

  it('are found by a place in the text, the delimiter row counted as the head’s', () => {
    expect(hereAt(lines, 3)).toEqual({ r: 0, c: 0 });
    expect(hereAt(lines, 9)).toEqual({ r: 0, c: 1 });
    expect(hereAt(lines, TABLE.indexOf('--:'))).toEqual({ r: 0, c: 1 });
    expect(hereAt(lines, TABLE.indexOf('Mara'))).toEqual({ r: 1, c: 0 });
    expect(hereAt(lines, TABLE.length)).toEqual({ r: 2, c: 1 });
  });

  it('are where they’re written', () => {
    const span = cellSpan(lines, { r: 1, c: 1 });
    expect(TABLE.slice(span.from, span.to)).toBe(' 30 ');
  });

  it('take the caret before their words, after them, or round them; an empty one between its spaces', () => {
    const at = (r: number, c: number, where: 'start' | 'end' | 'all') => {
      const { anchor, head } = caretIn(lines, { r, c }, where);
      return [anchor, head].map((n) => TABLE.slice(0, n).split('\n').at(-1));
    };
    expect(at(1, 0, 'start')).toEqual(['| ', '| ']);
    expect(at(1, 0, 'end')).toEqual(['| Mara', '| Mara']);
    expect(at(1, 0, 'all')).toEqual(['| ', '| Mara']);
    expect(at(2, 1, 'end')).toEqual(['| Levi | ', '| Levi | ']);
    expect(wordsIn('')).toEqual({ from: 0, to: 0 });
  });

  it('have edges where their words start and end', () => {
    expect(atEdge(' Mara ', 1, 'start')).toBe(true);
    expect(atEdge(' Mara ', 2, 'start')).toBe(false);
    expect(atEdge(' Mara ', 5, 'end')).toBe(true);
    expect(atEdge(' Mara ', 4, 'end')).toBe(false);
  });

  it('are aligned as their delimiter says', () => {
    expect(['---', ':--', ' :-: ', '--:', ' -: '].map(alignOf)).toEqual([
      'left',
      'left',
      'center',
      'right',
      'right',
    ]);
  });

  it('name their column by its head, or its number', () => {
    expect(columnName(lines, 1)).toBe('Age');
    expect(columnName(readTable('|  | b |\n|---|---|'), 0)).toBe('column 1');
  });
});

describe('the keys between cells', () => {
  const lines = readTable(TABLE);

  it('Tab goes on to the next cell, the next row, and past the last adds one', () => {
    expect(step(lines, { r: 0, c: 0 }, 'next')).toEqual({ here: { r: 0, c: 1 }, at: 'all' });
    expect(step(lines, { r: 0, c: 1 }, 'next')).toEqual({ here: { r: 1, c: 0 }, at: 'all' });
    expect(step(lines, { r: 2, c: 1 }, 'next')).toBe('add');
  });

  it('Shift-Tab goes back, and stays in the first cell', () => {
    expect(step(lines, { r: 1, c: 0 }, 'previous')).toEqual({ here: { r: 0, c: 1 }, at: 'all' });
    expect(step(lines, { r: 0, c: 0 }, 'previous')).toEqual({ here: { r: 0, c: 0 }, at: 'all' });
  });

  it('the arrows cross into the next cell, and leave the table at its edges', () => {
    expect(step(lines, { r: 1, c: 1 }, 'up')).toEqual({ here: { r: 0, c: 1 }, at: 'end' });
    expect(step(lines, { r: 0, c: 1 }, 'up')).toBeNull();
    expect(step(lines, { r: 2, c: 0 }, 'down')).toBeNull();
    expect(step(lines, { r: 1, c: 0 }, 'left')).toEqual({ here: { r: 0, c: 1 }, at: 'end' });
    expect(step(lines, { r: 1, c: 1 }, 'right')).toEqual({ here: { r: 2, c: 0 }, at: 'start' });
    expect(step(lines, { r: 2, c: 1 }, 'right')).toBeNull();
  });
});

describe('what goes into a cell', () => {
  it('is one line', () => {
    expect(oneLine('one\ntwo  \r\n  three')).toBe('one two three');
  });

  it('escapes a pipe, unless it’s escaped already', () => {
    expect(escapePipes('a|b')).toBe('a\\|b');
    expect(escapePipes('a\\|b')).toBe('a\\|b');
    expect(escapePipes('a\\\\|b')).toBe('a\\\\\\|b');
  });

  it('counts the backslashes typed before it', () => {
    expect(cellInput('x', '|', ' |')).toBe('\\|');
    expect(cellInput('x\\', '|', ' |')).toBe('|');
    expect(cellInput('x\\\\', '|', ' |')).toBe('\\|');
  });

  it('keeps a cell’s edge an edge, and an escaped pipe escaped', () => {
    // A backslash typed against the edge would escape it: it's doubled.
    expect(cellInput('a', '\\', '|b')).toBe('\\\\');
    // Typed between an escaping backslash and its pipe: the pipe stays escaped.
    expect(cellInput('a\\', 'x', '|b')).toBe('x\\');
  });
});
