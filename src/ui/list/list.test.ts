import { describe, expect, it } from 'vitest';
import type { NoteList } from '../vault/vault-state';
import { listLabel } from './list';

const search = (total: number, shown: number, within?: string): NoteList => ({
  kind: 'search',
  heading: '“scarf”',
  notes: Array.from({ length: shown }, (_, i) => ({
    path: `${i}.md`,
    title: `${i}`,
    modified: 0,
    words: 0,
    preview: '',
  })),
  total,
  sorts: [],
  ...(within ? { within } : {}),
});

describe('listLabel', () => {
  it('says how many a search found, and in which list when it was narrowed to one', () => {
    expect(listLabel(search(1, 1))).toBe('1 note matches');
    expect(listLabel(search(3, 3, 'Fic'))).toBe('3 notes match · Fic');
    expect(listLabel(search(0, 0, '#draft'))).toBe('No notes match · #draft');
    expect(listLabel(search(250, 200, 'All Notes'))).toBe(
      '250 notes match · the first 200 · All Notes',
    );
  });
});
