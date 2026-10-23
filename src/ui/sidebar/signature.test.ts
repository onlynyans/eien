import { describe, expect, it } from 'vitest';
import { buildTree } from '../../core/vault';
import type { ListedNote, NoteList } from '../vault/vault-state';
import { lookOf, noteRowShows } from './note-row';
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
const list = (notes: ListedNote[], over: Partial<NoteList> = {}): NoteList => ({
  kind: 'all',
  heading: 'All Notes',
  notes,
  total: notes.length,
  sort: 'modified',
  sorts: ['title', 'modified'],
  ...over,
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
  books: new Set(),
  notice: null,
});
const sign = sidebarSignature;

describe('sidebarSignature, the tree’s frame', () => {
  it('is the same while a note is opened or typed in, however its row changes', () => {
    const base = sign(model([note(), note({ path: 'B.md', title: 'B' })]));
    expect(sign(model([note({ path: 'B.md', title: 'B' }), note({ modified: at + MINUTE })]))).toBe(
      base,
    );
    expect(sign(model([note({ words: 121, preview: 'Another start.' }), note()]))).toBe(base);
  });

  it('changes with the open rows, the lists’ sizes and sorts, the news and the books', () => {
    const base = model([note()]);
    expect(sign(model([note()], []))).not.toBe(sign(base));
    expect(sign(model([note(), note({ path: 'B.md' })]))).not.toBe(sign(base));
    expect(
      sign({ ...base, notes: new Map([['/all', list([note()], { sort: 'title' })]]) }),
    ).not.toBe(sign(base));
    expect(sign({ ...base, notice: '“Ideas” is in the trash.' })).not.toBe(sign(base));
    expect(sign({ ...base, books: new Set(['Fic']) })).not.toBe(sign(base));
  });

  it('doesn’t care in what order the rows were opened', () => {
    expect(sign(model([note()], ['/all', 'Fic']))).toBe(sign(model([note()], ['Fic', '/all'])));
  });
});

describe('noteRowShows, what a note’s row shows', () => {
  const today = 'Tue Oct 20 2026';
  const shows = (n: ListedNote, l: NoteList = list([n]), open: string | null = null, day = today) =>
    noteRowShows(n, lookOf(n, l, '/all', 1, { active: open, other: null }), day);

  it('is the same while a note is typed in within the minute its time shows', () => {
    expect(shows(note({ modified: at + 59_000, words: 121 }))).toBe(shows(note()));
    // A preview isn't drawn in the tree.
    expect(shows(note({ preview: 'Another start.' }))).toBe(shows(note()));
  });

  it('changes with the minute, the day, a title, a number, being open, and a book’s words', () => {
    const base = shows(note());
    expect(shows(note({ modified: at + MINUTE }))).not.toBe(base);
    expect(shows(note(), list([note()]), null, 'Wed Oct 21 2026')).not.toBe(base);
    expect(shows(note({ title: 'Prologue' }))).not.toBe(base);
    expect(shows(note({ ordinal: 'ii' }))).not.toBe(base);
    expect(shows(note(), list([note()]), 'Chapter.md')).not.toBe(base);
    const book = list([note()], { kind: 'book', sort: 'order', folder: '' });
    expect(shows(note({ words: 121 }), book)).not.toBe(shows(note(), book));
  });
});
