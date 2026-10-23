// The search field as the window draws it (2026-10-22): a field set into
// the pane, the search icon in it for the eye alone, named for what it searches.

import { describe, expect, it } from 'vitest';
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
});
