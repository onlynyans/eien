// Insert Table: where the table goes, the blank lines round it, the caret.

import { describe, expect, it } from 'vitest';
import { apply } from './edit';
import { insertTable, NEW_TABLE } from './table';

/** The note after Insert Table with the caret at `at`, "‸" marking where the caret lands. */
function inserted(text: string, at: number, to = at): string {
  const edit = insertTable(text, { from: at, to });
  const after = apply(text, edit.changes);
  expect(edit.selection.from).toBe(edit.selection.to);
  return `${after.slice(0, edit.selection.from)}‸${after.slice(edit.selection.from)}`;
}

const FIRST = NEW_TABLE.replace('|  |', '| ‸ |');

describe('Insert Table', () => {
  it('is a header and two rows of two columns, as GFM writes a table', () => {
    expect(NEW_TABLE).toBe('|  |  |\n| --- | --- |\n|  |  |\n|  |  |');
  });

  it('fills an empty note, the caret in the first cell', () => {
    expect(inserted('', 0)).toBe(FIRST);
  });

  it('takes the caret’s blank line, with a blank line either side', () => {
    expect(inserted('Para\n\nNext', 5)).toBe(`Para\n\n${FIRST}\n\nNext`);
    expect(inserted('Para\n\n\nNext', 6)).toBe(`Para\n\n${FIRST}\n\nNext`);
    expect(inserted('Para\n', 5)).toBe(`Para\n\n${FIRST}`);
  });

  it('goes after the caret’s line when it has words, never through them', () => {
    expect(inserted('Para', 2)).toBe(`Para\n\n${FIRST}`);
    expect(inserted('Para\nNext', 1)).toBe(`Para\n\n${FIRST}\n\nNext`);
    expect(inserted('Para\n\nNext', 4)).toBe(`Para\n\n${FIRST}\n\nNext`);
  });

  it('keeps what was chosen, and goes after it', () => {
    expect(inserted('One two\nthree', 4, 11)).toBe(`One two\nthree\n\n${FIRST}`);
  });
});
