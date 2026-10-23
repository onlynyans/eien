import { describe, expect, it } from 'vitest';
import { nameWindow } from './window-name';

describe('the window’s name (New Window: windows are listed by it)', () => {
  it('is its note’s title, or its vault’s name with no note open', () => {
    nameWindow('Fic/Beneath the Walls/What the Recruits Say.md', 'Vault');
    expect(document.title).toBe('What the Recruits Say');
    nameWindow(null, 'Vault');
    expect(document.title).toBe('Vault');
  });
});
