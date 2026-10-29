import { describe, expect, it, vi } from 'vitest';
import { withDefaults } from '../../core/config';
import { epubStore } from './epub-store';
import type { LookStore } from './quick-look';

function window(chosen = {}) {
  let listener: ((values: LookStore['values']) => void) | null = null;
  const store: LookStore = {
    values: withDefaults(chosen),
    set: vi.fn(async () => {}),
    onChange: (heard) => {
      listener = heard;
      return () => {};
    },
  };
  return { store, tell: (values: LookStore['values']) => listener?.(values) };
}

describe('the shelf’s look', () => {
  it('reads a page setting from its epub. key, and any other from the window', () => {
    const { store } = window({
      'appearance.leading': 'tight',
      'epub.appearance.leading': 'loose',
      'appearance.scheme': 'night',
    });
    const shelf = epubStore(store);
    expect(shelf.values['appearance.leading']).toBe('loose');
    expect(shelf.values['appearance.scheme']).toBe('night');
  });

  it('keeps a page setting under its epub. key, the notes’ untouched, and Day or night as the window’s', async () => {
    const { store } = window();
    const shelf = epubStore(store);
    await shelf.set('page.width', 'wide');
    await shelf.set('appearance.scheme', 'night');
    expect(store.set).toHaveBeenNthCalledWith(1, 'epub.page.width', 'wide');
    expect(store.set).toHaveBeenNthCalledWith(2, 'appearance.scheme', 'night');
  });

  it('tells a change as the shelf wears it', () => {
    const { store, tell } = window();
    const heard = vi.fn();
    epubStore(store).onChange(heard);
    tell(withDefaults({ 'epub.appearance.face': 'literata' }));
    expect(heard.mock.calls[0]?.[0]['appearance.face']).toBe('literata');
  });
});
