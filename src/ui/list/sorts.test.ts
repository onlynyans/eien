// What each list's lens is on this device, kept in the window's storage.

import { beforeEach, describe, expect, it } from 'vitest';
import { followSorts, nestedFor, rememberNested } from './sorts';

beforeEach(() => localStorage.clear());

describe('Include subfolders, per folder', () => {
  it('is off until chosen, kept per folder, and forgotten when turned off', () => {
    expect(nestedFor('folder:Fic')).toBe(false);
    rememberNested('folder:Fic', true);
    expect(nestedFor('folder:Fic')).toBe(true);
    expect(nestedFor('folder:Notes')).toBe(false);
    rememberNested('folder:Fic', false);
    expect(localStorage.getItem('eien.subfolders')).toBe('{}');
  });

  it('follows a folder renamed or moved, and the folders in it', () => {
    rememberNested('folder:Fic', true);
    rememberNested('folder:Fic/Arc 1', true);
    rememberNested('folder:Ficus', true);
    followSorts('Fic', 'Stories/Fic');
    expect(nestedFor('folder:Stories/Fic')).toBe(true);
    expect(nestedFor('folder:Stories/Fic/Arc 1')).toBe(true);
    expect(nestedFor('folder:Fic')).toBe(false);
    expect(nestedFor('folder:Ficus')).toBe(true);
  });
});
