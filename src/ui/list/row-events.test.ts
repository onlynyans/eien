// A note's row: a click opens it; Ctrl-click and Ctrl+Enter (⌘ on a Mac)
// open it beside the page open, where the window can split.

import { describe, expect, it, vi } from 'vitest';
import { h } from '../dom';
import { type RowActions, rowEvents } from './row-events';

function row(actions: Partial<RowActions>) {
  const all: RowActions = {
    open: vi.fn(),
    menu: vi.fn(),
    rename: vi.fn(),
    trash: vi.fn(),
    ...actions,
  };
  const button = h('button', { attrs: { type: 'button' }, on: rowEvents('Snow.md', all, false) });
  document.body.replaceChildren(button);
  return { button, all };
}

describe('a note’s row, beside', () => {
  it('opens the note beside with the modifier held, on a click or Enter', () => {
    const openBeside = vi.fn();
    const { button, all } = row({ openBeside });
    // happy-dom's platform isn't a Mac's: the modifier is Ctrl.
    button.dispatchEvent(new MouseEvent('click', { ctrlKey: true, bubbles: true }));
    const enter = new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, cancelable: true });
    button.dispatchEvent(enter);
    expect(openBeside.mock.calls).toEqual([['Snow.md'], ['Snow.md']]);
    expect(enter.defaultPrevented).toBe(true); // no click from Enter on the button besides
    expect(all.open).not.toHaveBeenCalled();
  });

  it('opens the note on the page where nothing can split (a phone)', () => {
    const { button, all } = row({});
    button.dispatchEvent(new MouseEvent('click', { ctrlKey: true, bubbles: true }));
    expect(all.open).toHaveBeenCalledWith('Snow.md');
  });
});
