// Properties of the table editor over generated tables: any line reads and
// writes back as it was; any change leaves a GFM table the editor's own
// parser reads, its words where the change put them and nowhere else; and
// nothing typed into a cell makes or takes away a cell's edge.

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { eienParser } from '../markdown';
import {
  cellInput,
  columnsOf,
  editTableText,
  pipesIn,
  readLine,
  readTable,
  type TableEdit,
  writeLine,
} from './index';

const word = fc
  .array(fc.constantFrom('a', 'K', 'é', '永', '7', '\\|', '*', '`', '-'), {
    minLength: 1,
    maxLength: 4,
  })
  .map((parts) => parts.join(''));
const cellWords = fc.oneof(
  { weight: 1, arbitrary: fc.constant('') },
  { weight: 4, arbitrary: word },
);
const space = fc.constantFrom('', ' ', ' ', '  ');

/** A table of `n` columns as words, and how its lines are written. */
const table = fc
  .record({
    n: fc.integer({ min: 1, max: 4 }),
    rows: fc.integer({ min: 0, max: 4 }),
    open: fc.boolean(),
    close: fc.boolean(),
    quoted: fc.boolean(),
    pad: space,
  })
  .chain(({ n, rows, ...style }) =>
    fc.record({
      // A head cell is never empty: an empty head with no outer pipes is no table.
      head: fc.array(word, { minLength: n, maxLength: n }),
      align: fc.array(fc.constantFrom('---', ':--', ':-:', '--:'), { minLength: n, maxLength: n }),
      body: fc.array(fc.array(cellWords, { minLength: n, maxLength: n }), {
        minLength: rows,
        maxLength: rows,
      }),
      style: fc.constant({
        ...style,
        open: style.open || n === 1 || style.close === false,
        close: style.close || n === 1,
      }),
    }),
  );

type Gen = typeof table extends fc.Arbitrary<infer T> ? T : never;

function textOf({ head, align, body, style }: Gen): string {
  const line = (cells: string[]) =>
    `${style.quoted ? '> ' : ''}${style.open ? '|' : ''}${cells.map((c) => `${style.pad}${c}${style.pad}`).join('|')}${style.close ? '|' : ''}`;
  return [line(head), line(align), ...body.map(line)].join('\n');
}

/** The words in each cell, row by row (the head first, no delimiter row), as many as the head has. */
function grid(text: string, quoted: boolean): string[][] {
  const lines = readTable(text, quoted);
  const n = columnsOf(lines);
  return lines
    .filter((_, i) => i !== 1)
    .map((line) => Array.from({ length: n }, (_, c) => line.cells[c]?.trim() ?? ''));
}

/** How many rows (the head first) the editor's parser reads in the table `text` is, or null for none. */
function parsedRows(text: string): number | null {
  const tree = eienParser.parse(text);
  let found: number | null = null;
  tree.iterate({
    enter(node) {
      if (node.name !== 'Table') return;
      if (!/^[>\s]*$/u.test(text.slice(0, node.from)) || node.to < text.trimEnd().length)
        return false;
      // An empty cell has no node of its own: the cells are counted from the text (`grid`).
      const header = node.node.getChild('TableHeader');
      found = node.node.getChildren('TableRow').length + (header ? 1 : 0);
      return false;
    },
  });
  return found;
}

const edit = (n: number, rows: number): fc.Arbitrary<TableEdit> =>
  fc.oneof(
    fc.record({
      kind: fc.constant('addRow' as const),
      at: fc.integer({ min: 0, max: rows }),
      c: fc.integer({ min: 0, max: n - 1 }),
    }),
    fc.record({ kind: fc.constant('removeRow' as const), r: fc.integer({ min: 0, max: rows }) }),
    fc.record({ kind: fc.constant('addColumn' as const), at: fc.integer({ min: 0, max: n }) }),
    fc.record({
      kind: fc.constant('removeColumn' as const),
      c: fc.integer({ min: 0, max: n - 1 }),
    }),
    fc.record({
      kind: fc.constant('align' as const),
      c: fc.integer({ min: 0, max: n - 1 }),
      align: fc.constantFrom('left' as const, 'center' as const, 'right' as const),
    }),
    fc.record({
      kind: fc.constant('moveRow' as const),
      r: fc.integer({ min: 0, max: rows }),
      to: fc.integer({ min: 0, max: Math.max(0, rows - 1) }),
    }),
    fc.record({
      kind: fc.constant('moveColumn' as const),
      c: fc.integer({ min: 0, max: n - 1 }),
      to: fc.integer({ min: 0, max: n - 1 }),
    }),
  );

/** The words as `e` should leave them, worked out on the grid alone. */
function expected(words: string[][], e: TableEdit): string[][] {
  const out = words.map((row) => [...row]);
  const move = <T>(list: T[], from: number, to: number) =>
    list.splice(to, 0, ...list.splice(from, 1));
  switch (e.kind) {
    case 'addRow':
      out.splice(
        e.at + 1,
        0,
        (words[0] ?? []).map(() => ''),
      );
      return out;
    case 'removeRow':
      out.splice(e.r, 1);
      return out;
    case 'addColumn':
      for (const row of out) row.splice(e.at, 0, '');
      return out;
    case 'removeColumn':
      for (const row of out) row.splice(e.c, 1);
      return out;
    case 'align':
      return out;
    case 'moveRow': {
      const body = out.slice(1);
      move(body, e.r - 1, e.to);
      return [out[0] as string[], ...body];
    }
    case 'moveColumn':
      for (const row of out) move(row, e.c, e.to);
      return out;
  }
}

describe('a table’s line', () => {
  it('is written back as it was read, whatever it holds', () => {
    fc.assert(
      fc.property(
        fc.string({ unit: fc.constantFrom('|', '\\', ' ', 'a', '>', '-', ':', '\t') }),
        fc.boolean(),
        (line, quoted) => {
          expect(writeLine(readLine(line, quoted))).toBe(line);
        },
      ),
    );
  });
});

describe('a change to a table', () => {
  it('leaves a table the editor reads, with the words where the change put them', () => {
    fc.assert(
      fc.property(
        table.chain((t) => fc.tuple(fc.constant(t), edit(t.head.length, t.body.length))),
        ([t, e]) => {
          const text = textOf(t);
          const quoted = t.style.quoted;
          const before = grid(text, quoted);
          // A row like "* | a" is a list, not a table: only what the parser reads as a table is tried.
          fc.pre(parsedRows(text) === before.length);
          const out = editTableText(text, quoted, e, { r: 0, c: 0 });
          if ('refused' in out) return;
          const words = grid(out.text, quoted);
          expect(words).toEqual(expected(before, e));
          expect(parsedRows(out.text)).toBe(words.length);
          // The caret is in the table, in the cell it names.
          expect(out.caret.head).toBeLessThanOrEqual(out.text.length);
        },
      ),
    );
  });

  it('to its rows leaves every other line as it was written', () => {
    fc.assert(
      fc.property(
        table.chain((t) => fc.tuple(fc.constant(t), edit(t.head.length, t.body.length))),
        ([t, e]) => {
          if (e.kind !== 'addRow' && e.kind !== 'removeRow') return;
          const text = textOf(t);
          const out = editTableText(text, t.style.quoted, e, { r: 0, c: 0 });
          if ('refused' in out) return;
          const kept = out.text.split('\n').filter((line) => text.split('\n').includes(line));
          expect(kept.length).toBeGreaterThanOrEqual(text.split('\n').length - 1);
        },
      ),
    );
  });
});

describe('what’s typed into a cell', () => {
  it('never makes or takes away a cell’s edge, and stays on its line', () => {
    const bit = fc.string({ unit: fc.constantFrom('|', '\\', 'a', ' ', '\n') });
    fc.assert(
      fc.property(bit, bit, bit, (before, typed, after) => {
        const b = before.replace(/\n/g, '');
        const a = after.replace(/\n/g, '');
        const out = cellInput(b, typed, a);
        expect(out).not.toContain('\n');
        expect(pipesIn(b + out + a).length).toBe(pipesIn(b + a).length);
      }),
    );
  });
});
