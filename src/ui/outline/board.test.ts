import { describe, expect, it } from 'vitest';
import { PREVIEW_LENGTH } from '../../core/note';
import { summaryOf } from './board';

describe('a card’s first lines', () => {
  it('are the preview, cut at a word and marked when the index cut it', () => {
    expect(summaryOf('Short and whole.')).toBe('Short and whole.');
    // Within two of the index's length it was cut (its last spaces trimmed); shorter, it's whole.
    const long = 'word '.repeat(PREVIEW_LENGTH).slice(0, PREVIEW_LENGTH - 3);
    expect(long.length).toBe(PREVIEW_LENGTH - 3);
    expect(summaryOf(long)).toBe(long);
    const cut = `${'word '.repeat(31)}chapter goes on`.slice(0, PREVIEW_LENGTH); // ends "chapt"
    expect(cut.endsWith('chapt')).toBe(true);
    expect(summaryOf(cut)).toMatch(/word…$/u);
    expect(summaryOf(cut)).not.toContain('chapt');
  });
});
