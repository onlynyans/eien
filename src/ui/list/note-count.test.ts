import { describe, expect, it } from 'vitest';
import { noteCount } from './note-count';

describe('noteCount', () => {
  it('says "note" for one, "notes" for any other number, with its separators', () => {
    expect(noteCount(1)).toBe('1 note');
    expect(noteCount(0)).toBe('0 notes');
    expect(noteCount(2)).toBe('2 notes');
    expect(noteCount(3002)).toBe(`${(3002).toLocaleString()} notes`);
  });
});
