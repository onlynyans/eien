import { describe, expect, it } from 'vitest';
import { buildTree } from '../../core/vault';
import type { ListedNote, NoteList } from '../vault/vault-state';
import { sidebarSignature } from './signature';

const MINUTE = 60_000;
const at = Date.UTC(2026, 9, 20, 16, 40, 0);
const note = (over: Partial<ListedNote> = {}): ListedNote => ({
  path: 'Chapter.md',
  title: 'Chapter',
  modified: at,
  words: 120,
  preview: 'The first line.',
  ...over,
});
const list = (notes: ListedNote[]): NoteList => ({
  kind: 'all',
  heading: 'All Notes',
  notes,
  total: notes.length,
  sort: 'modified',
  sorts: ['title', 'modified'],
});
const model = (
  notes: ListedNote[],
  open: string[] = ['/all'],
): Parameters<typeof sidebarSignature>[0] => ({
  tree: buildTree([{ path: 'Chapter.md', kind: 'note', modified: at, size: 10 }], 'V'),
  tags: [],
  pinned: 0,
  selection: { kind: 'all' },
  open: new Set(open),
  two: true,
  notes: new Map([['/all', list(notes)]]),
  results: null,
  openNote: 'Chapter.md',
  notice: null,
  scheme: 'system',
});
const sign = (m: ReturnType<typeof model>, today = 'Tue Oct 20 2026') => sidebarSignature(m, today);

describe('sidebarSignature', () => {
  it('is the same while a note is typed in within the minute its time shows', () => {
    expect(sign(model([note({ modified: at + 59_000, words: 120 })]))).toBe(sign(model([note()])));
    // A preview isn't drawn in the tree.
    expect(sign(model([note({ preview: 'Another start.' })]))).toBe(sign(model([note()])));
  });

  it('changes with what the tree shows: the minute, a title, a number, the words, the order', () => {
    const base = sign(model([note()]));
    expect(sign(model([note({ modified: at + MINUTE })]))).not.toBe(base);
    expect(sign(model([note({ title: 'Prologue' })]))).not.toBe(base);
    expect(sign(model([note({ ordinal: 'ii' })]))).not.toBe(base);
    expect(sign(model([note({ words: 121 })]))).not.toBe(base);
    const two = [note(), note({ path: 'B.md', title: 'B' })];
    expect(sign(model(two))).not.toBe(sign(model([...two].reverse())));
  });

  it('changes with the day, the open rows, the news and the open note', () => {
    const base = model([note()]);
    expect(sign(base, 'Wed Oct 21 2026')).not.toBe(sign(base));
    expect(sign(model([note()], []))).not.toBe(sign(base));
    expect(sign({ ...base, notice: '“Ideas” is in the trash.' })).not.toBe(sign(base));
    expect(sign({ ...base, openNote: null })).not.toBe(sign(base));
  });

  it('doesn’t care in what order the rows were opened', () => {
    expect(sign(model([note()], ['/all', 'Fic']))).toBe(sign(model([note()], ['Fic', '/all'])));
  });
});
