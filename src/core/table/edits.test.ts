// The table editor's changes, on the text as it's saved: each one touches
// only the cells it must, says where the caret goes, and says when words went.

import { describe, expect, it } from 'vitest';
import { editTableText, type Here, type TableEdit } from './index';

const TABLE = ['| Name | Age |', '|---|--:|', '| Mara | 30 |', '| Levi |  |'].join('\n');

function edited(edit: TableEdit, here: Here = { r: 1, c: 0 }, text = TABLE, quoted = false) {
  const out = editTableText(text, quoted, edit, here);
  if ('refused' in out) return out;
  const caret = out.text.slice(0, out.caret.head).split('\n').at(-1);
  return { lines: out.text.split('\n'), here: out.here, caret, lost: out.lost };
}

describe('rows', () => {
  it('are added under the head row or another, empty, the caret in the new row', () => {
    expect(edited({ kind: 'addRow', at: 1, c: 1 })).toEqual({
      lines: ['| Name | Age |', '|---|--:|', '| Mara | 30 |', '|  |  |', '| Levi |  |'],
      here: { r: 2, c: 1 },
      caret: '|  | ',
      lost: false,
    });
    expect(edited({ kind: 'addRow', at: 0, c: 0 })).toMatchObject({
      lines: ['| Name | Age |', '|---|--:|', '|  |  |', '| Mara | 30 |', '| Levi |  |'],
    });
  });

  it('are added in a quote as the quote’s', () => {
    const quoted = '> | a | b |\n> |---|---|\n> | c | d |';
    expect(edited({ kind: 'addRow', at: 1, c: 0 }, { r: 1, c: 0 }, quoted, true)).toMatchObject({
      lines: ['> | a | b |', '> |---|---|', '> | c | d |', '> |  |  |'],
    });
  });

  it('are removed, saying when words went with them; the head row stays', () => {
    expect(edited({ kind: 'removeRow', r: 1 })).toMatchObject({
      lines: ['| Name | Age |', '|---|--:|', '| Levi |  |'],
      here: { r: 1, c: 0 },
      lost: true,
    });
    const blank = TABLE.replace('| Levi |  |', '|  |  |');
    expect(edited({ kind: 'removeRow', r: 2 }, { r: 2, c: 0 }, blank)).toMatchObject({
      lost: false,
      here: { r: 1, c: 0 },
    });
    expect(edited({ kind: 'removeRow', r: 0 })).toEqual({ refused: 'head row' });
  });

  it('move, the other rows keeping their order', () => {
    expect(edited({ kind: 'moveRow', r: 1, to: 1 })).toMatchObject({
      lines: ['| Name | Age |', '|---|--:|', '| Levi |  |', '| Mara | 30 |'],
      here: { r: 2, c: 0 },
    });
    expect(edited({ kind: 'moveRow', r: 1, to: 0 })).toEqual({ refused: 'nothing' });
    expect(edited({ kind: 'moveRow', r: 0, to: 1 })).toEqual({ refused: 'nothing' });
  });
});

describe('columns', () => {
  it('are added on any side, with a delimiter, the caret in the new head to name it', () => {
    expect(edited({ kind: 'addColumn', at: 1 })).toEqual({
      lines: ['| Name |  | Age |', '|---| --- |--:|', '| Mara |  | 30 |', '| Levi |  |  |'],
      here: { r: 0, c: 1 },
      caret: '| Name | ',
      lost: false,
    });
    expect(edited({ kind: 'addColumn', at: 2 })).toMatchObject({
      lines: ['| Name | Age |  |', '|---|--:| --- |', '| Mara | 30 |  |', '| Levi |  |  |'],
    });
  });

  it('fill a short row out first', () => {
    expect(
      edited({ kind: 'addColumn', at: 2 }, { r: 0, c: 0 }, '| a | b |\n|---|---|\n| c |'),
    ).toMatchObject({
      lines: ['| a | b |  |', '|---|---| --- |', '| c |  |  |'],
    });
  });

  it('are removed, saying when words went; the last one stays', () => {
    expect(edited({ kind: 'removeColumn', c: 0 })).toMatchObject({
      lines: ['| Age |', '|--:|', '| 30 |', '|  |'],
      here: { r: 1, c: 0 },
      lost: true,
    });
    expect(edited({ kind: 'removeColumn', c: 0 }, { r: 0, c: 0 }, '| a |\n|---|')).toEqual({
      refused: 'last column',
    });
    expect(
      edited({ kind: 'removeColumn', c: 1 }, { r: 0, c: 0 }, '| a |  |\n|---|---|'),
    ).toMatchObject({
      lost: false,
    });
  });

  it('removed down to one keep their pipes, or they’d be no table', () => {
    expect(
      edited({ kind: 'removeColumn', c: 1 }, { r: 0, c: 0 }, 'a | b\n--|--\nc | d'),
    ).toMatchObject({
      lines: ['|a |', '|--|', '|c |'],
    });
  });

  it('move, every row’s cell with it', () => {
    expect(edited({ kind: 'moveColumn', c: 0, to: 1 })).toMatchObject({
      lines: ['| Age | Name |', '|--:|---|', '| 30 | Mara |', '|  | Levi |'],
      here: { r: 1, c: 1 },
    });
  });

  it('are aligned left, centre or right, keeping the delimiter’s width and spaces', () => {
    expect(edited({ kind: 'align', c: 0, align: 'center' })).toMatchObject({
      lines: ['| Name | Age |', '|:---:|--:|', '| Mara | 30 |', '| Levi |  |'],
    });
    expect(edited({ kind: 'align', c: 1, align: 'left' })).toMatchObject({
      lines: ['| Name | Age |', '|---|---|', '| Mara | 30 |', '| Levi |  |'],
    });
    expect(edited({ kind: 'align', c: 1, align: 'right' })).toEqual({ refused: 'nothing' });
    expect(
      edited({ kind: 'align', c: 0, align: 'right' }, { r: 0, c: 0 }, '| a |\n| - |'),
    ).toMatchObject({
      lines: ['| a |', '| --: |'],
    });
  });
});
