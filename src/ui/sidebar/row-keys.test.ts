// What a folder's and a tag's rows answer to, besides a plain click.

import { describe, expect, it, vi } from 'vitest';
import { folderRowEvents, tagRowEvents } from './row-keys';

/** A button with `on`'s listeners, as h() would make it. */
function button(on: Record<string, (event: never) => void> | undefined) {
  const element = document.createElement('button');
  for (const [name, run] of Object.entries(on ?? {}))
    element.addEventListener(name, run as EventListener);
  document.body.replaceChildren(element);
  return element;
}
const key = (element: HTMLElement, init: KeyboardEventInit) => {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
  element.dispatchEvent(event);
  return event.defaultPrevented;
};

describe('a folder’s row', () => {
  it('⌥ and an arrow move it; F2 renames; the menu key opens its menu', () => {
    const on = { menu: vi.fn(), rename: vi.fn(), move: vi.fn() };
    const row = button(folderRowEvents(on));
    expect(key(row, { key: 'ArrowUp', altKey: true })).toBe(true);
    key(row, { key: 'ArrowDown', altKey: true });
    key(row, { key: 'ArrowLeft', altKey: true });
    key(row, { key: 'ArrowRight', altKey: true });
    expect(on.move.mock.calls).toEqual([['up'], ['down'], ['out'], ['in']]);
    key(row, { key: 'F2' });
    expect(on.rename).toHaveBeenCalledOnce();
    key(row, { key: 'F10', shiftKey: true });
    expect(on.menu).toHaveBeenCalledOnce();
  });

  it('leaves the arrows alone without ⌥, or with ⌘ or Ctrl too', () => {
    const on = { menu: vi.fn(), rename: vi.fn(), move: vi.fn() };
    const row = button(folderRowEvents(on));
    expect(key(row, { key: 'ArrowUp' })).toBe(false);
    key(row, { key: 'ArrowUp', altKey: true, metaKey: true });
    key(row, { key: 'ArrowUp', altKey: true, ctrlKey: true });
    expect(on.move).not.toHaveBeenCalled();
  });
});

describe('a tag’s row', () => {
  const tag = () => {
    const on = { select: vi.fn(), menu: vi.fn(), move: vi.fn(), filter: vi.fn() };
    return { on, row: button(tagRowEvents(on)) };
  };

  it('a click chooses it; ⇧ wants it in the list’s filter, ⌥ keeps it out', () => {
    const { on, row } = tag();
    row.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(on.select).toHaveBeenCalledOnce();
    row.dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true }));
    row.dispatchEvent(new MouseEvent('click', { bubbles: true, altKey: true }));
    expect(on.filter.mock.calls).toEqual([[false], [true]]);
    expect(on.select).toHaveBeenCalledOnce();
  });

  it('⇧Enter and ⌥Enter do the same from the keyboard; ⌥↑ ⌥↓ move it', () => {
    const { on, row } = tag();
    key(row, { key: 'Enter', shiftKey: true });
    key(row, { key: 'Enter', altKey: true });
    expect(on.filter.mock.calls).toEqual([[false], [true]]);
    key(row, { key: 'ArrowDown', altKey: true });
    expect(on.move).toHaveBeenCalledWith(1);
  });
});
