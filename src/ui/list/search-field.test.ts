// The search field as the window draws it (2026-10-22): a field set into
// the pane, the search icon in it for the eye alone, named for what it searches.

import { describe, expect, it, vi } from 'vitest';
import { SearchField } from './search-field';

describe('the search field', () => {
  it('holds the search icon, hidden from a screen reader, before the field', () => {
    const search = new SearchField(() => {});
    const slot = document.createElement('div');
    search.place(slot, 'Vault');
    const [glass, input] = [...search.element.children];
    expect(glass?.classList.contains('search__icon')).toBe(true);
    expect(glass?.getAttribute('aria-hidden')).toBe('true');
    expect(input?.getAttribute('aria-label')).toBe('Search Vault');
    expect(search.element.getAttribute('role')).toBe('search');
  });

  // #40, Phase 5c: beside a book's rows, Enter goes to its next match.
  it('hands Enter (⇧Enter back) to what it searches, the words typed searched first', () => {
    vi.useFakeTimers();
    const searched = vi.fn();
    const enter = vi.fn(() => true);
    const search = new SearchField(searched, enter);
    const input = search.element.querySelector('input') as HTMLInputElement;
    input.value = 'Bennet';
    input.dispatchEvent(new Event('input'));
    const press = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });
    input.dispatchEvent(press);
    // Not the last words: the pause before searching cut short, once.
    expect(searched).toHaveBeenCalledExactlyOnceWith('Bennet');
    expect(enter).toHaveBeenCalledWith(false);
    expect(press.defaultPrevented).toBe(true);
    vi.advanceTimersByTime(1000);
    expect(searched).toHaveBeenCalledTimes(1);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true }));
    expect(enter).toHaveBeenLastCalledWith(true);
    vi.useRealTimers();
  });

  it('leaves Enter to the field where nothing takes it', () => {
    const search = new SearchField(
      () => {},
      () => false,
    );
    const input = search.element.querySelector('input') as HTMLInputElement;
    const press = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });
    input.dispatchEvent(press);
    expect(press.defaultPrevented).toBe(false);
  });
});
