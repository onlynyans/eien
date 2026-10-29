import { describe, expect, it } from 'vitest';
import { nameWindow } from './window-name';

describe('the window’s name (New Window: windows are listed by it)', () => {
  it('is its page’s name (a note’s title, a book’s), or its vault’s with nothing open', () => {
    nameWindow('What the Recruits Say', 'Vault');
    expect(document.title).toBe('What the Recruits Say');
    nameWindow('Pride and Prejudice', 'Vault');
    expect(document.title).toBe('Pride and Prejudice');
    nameWindow('', 'Vault');
    expect(document.title).toBe('Vault');
    nameWindow(null, 'Vault');
    expect(document.title).toBe('Vault');
  });
});
