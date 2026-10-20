// Adversarial: a folder synced from Linux or Android, where two notes may
// differ only in case (those file systems keep both).

import { describe, expect, it } from 'vitest';
import { orderNames } from './index';

describe('orderNames on a case-sensitive file system', () => {
  it('lists both of two notes that differ only in case', () => {
    expect(orderNames(['Note.md', 'note.md'], []).sort()).toEqual(['Note.md', 'note.md']);
  });

  it('lists both when the folder’s order names one of them', () => {
    expect(orderNames(['Note.md', 'note.md'], ['note.md']).sort()).toEqual(['Note.md', 'note.md']);
  });
});
