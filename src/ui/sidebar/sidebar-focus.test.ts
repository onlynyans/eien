// Where the keyboard goes when the tree is drawn again: kept, given to a row
// asked for, or left on the row in a gone one's place. A folder that changes
// sections (#40) goes through the same paths.

import { beforeEach, describe, expect, it } from 'vitest';
import { SidebarFocus } from './sidebar-focus';
import type { TreeWindows } from './tree-windows';

const body = document.createElement('div');
const noWindows = { focusKey: () => false } as unknown as TreeWindows;
const focus = new SidebarFocus(body, noWindows, document.createElement('div'), () => false);

/** The tree drawn anew, its rows by data-key, in order. */
function draw(keys: string[]): void {
  body.replaceChildren(
    ...keys.map((key) => {
      const row = document.createElement('button');
      row.className = 'tree-row__name';
      row.dataset.key = key;
      return row;
    }),
  );
}
const focused = () => (document.activeElement as HTMLElement | null)?.dataset.key;
const press = (key: string) => body.querySelector<HTMLElement>(`[data-key="${key}"]`)?.focus();

beforeEach(() => {
  document.body.replaceChildren(body);
  focus.asked = null;
});

describe('the keyboard across a redraw', () => {
  it('stays on SHELF’s folder when the folder joins FOLDERS above it (its first note made)', () => {
    draw(['all', 'folder:Drafts', 'shelf:Novels', 'epub:Novels/Emma.epub']);
    press('shelf:Novels');
    const giveBack = focus.hold();
    draw(['all', 'folder:Drafts', 'folder:Novels', 'shelf:Novels', 'epub:Novels/Emma.epub']);
    giveBack();
    expect(focused()).toBe('shelf:Novels');
  });

  it('goes to the row in its place when FOLDERS’ row leaves for SHELF (its last note gone)', () => {
    draw(['all', 'folder:Drafts', 'folder:Novels', 'folder:Zines', 'shelf:Novels']);
    press('folder:Novels');
    const giveBack = focus.hold();
    draw(['all', 'folder:Drafts', 'folder:Zines', 'shelf:Novels']);
    giveBack();
    expect(focused()).toBe('folder:Zines');
  });

  it('gives it to the first row asked for that’s there: the folder moved, in whichever section has it', () => {
    draw(['all', 'shelf:Novels']);
    focus.asked = ['folder:Reading/Novels', 'shelf:Reading/Novels'];
    const giveBack = focus.hold();
    draw(['all', 'shelf:Reading', 'shelf:Reading/Novels']);
    giveBack();
    expect(focused()).toBe('shelf:Reading/Novels');
    focus.asked = ['shelf:Reading', 'folder:Reading'];
    const again = focus.hold();
    draw(['all', 'folder:Reading', 'shelf:Reading']);
    again();
    expect(focused()).toBe('shelf:Reading');
  });
});
