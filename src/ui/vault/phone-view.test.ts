// The system's back on the vault (#70): what it does first, a book's own step
// back before a pane, and a trackpad's gesture pressing no Esc.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, type SettingValues } from '../../core/config';
import type { Room } from '../phone/room';
import { type PhoneView, phoneView } from './phone-view';

let view: PhoneView | undefined;

/** A vault's phone view in `room`, its active page a book whose step back is `back`. */
function make(room: Room, back = vi.fn(() => true), outline = { open: false, toggle: vi.fn() }) {
  const values: SettingValues = { ...DEFAULT_SETTINGS, 'appearance.room': room };
  const shell = document.createElement('div');
  const page = { kind: 'epub', go: () => {}, back, page: { focus: vi.fn() }, path: 'Book.epub' };
  document.body.append(shell);
  view = phoneView({
    shell,
    platform: 'android',
    list: document.createElement('section'),
    menu: { run: vi.fn() } as never,
    settings: { values, onChange: () => () => {} } as never,
    sidebar: { focusTree: vi.fn() } as never,
    pages: { active: page, activeNote: null, other: null, split: false } as never,
    has: () => true,
    parts: () => ({ outline }) as never,
    changed: vi.fn(),
  });
  return { view, back };
}

afterEach(() => {
  view?.stop();
  view = undefined;
  document.body.replaceChildren();
});

describe('the system’s back on the vault (#70)', () => {
  it('with the panes, takes a book’s own step back first', () => {
    const { view, back } = make('panes');
    expect(view.back(false)).toBe(true);
    expect(back).toHaveBeenCalledOnce();
  });

  it('with no step back in the book, leaves it to the panes', () => {
    const { view } = make(
      'panes',
      vi.fn(() => false),
    );
    expect(view.back(false)).toBe(false);
  });

  it('one at a time, takes the book’s step back on the page, then steps back through the panes', () => {
    const { view, back } = make(
      'one',
      vi.fn(() => false),
    );
    view.stack.show('page');
    expect(view.back(false)).toBe(true);
    expect(back).toHaveBeenCalledOnce();
    expect(view.stack.shown).toBe('list');
    expect(view.back(false)).toBe(true);
    expect(view.stack.shown).toBe('sidebar');
    expect(view.back(false)).toBe(false);
  });

  it('never moves a book out of sight: with the list shown, back goes to the sidebar', () => {
    const { view, back } = make('one');
    view.stack.show('list');
    expect(view.back(false)).toBe(true);
    expect(back).not.toHaveBeenCalled();
    expect(view.stack.shown).toBe('sidebar');
  });

  it('presses Esc for the system’s back, and never for a trackpad’s gesture', () => {
    const { view } = make(
      'panes',
      vi.fn(() => false),
    );
    const field = document.createElement('input');
    document.body.append(field);
    field.focus();
    const esc = vi.fn((event: KeyboardEvent) => event.preventDefault());
    field.addEventListener('keydown', esc);
    expect(view.back(true)).toBe(false);
    expect(esc).not.toHaveBeenCalled();
    expect(view.back(false)).toBe(true);
    expect(esc).toHaveBeenCalledOnce();
  });

  it('with two pages, puts the notes over the book away before the book’s step back', () => {
    const { view, back } = make('pages');
    view.stack.show('list');
    expect(view.back(false)).toBe(true);
    expect(view.stack.shown).toBe('page');
    expect(back).not.toHaveBeenCalled();
    expect(view.back(false)).toBe(true);
    expect(back).toHaveBeenCalledOnce();
  });

  it('closes what lies over the page before the book’s step back', () => {
    const outline = { open: true, toggle: vi.fn() };
    const { view, back } = make('one', undefined, outline);
    view.stack.show('page');
    expect(view.back(false)).toBe(true);
    expect(outline.toggle).toHaveBeenCalledOnce();
    expect(back).not.toHaveBeenCalled();
  });
});
