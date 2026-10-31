// A book searched in the background (#40, Phase 5c): every chapter in the
// reading order, each read once and kept for the next words, never while a
// page turns, a new search stopping the last, and the count's limit kept.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { AS_WRITTEN, type Chapter, type Epub, matcherOf, type Refusal } from '../../core/epub';
import { COUNT_LIMIT } from '../../core/find';
import { BookSearch, BookTexts } from './book-search';

/** A book of `chapters`, each its paragraphs' words, and how often each chapter was read. */
function book(chapters: readonly (readonly string[] | null)[], key = 'k') {
  const reads = chapters.map(() => 0);
  const epub = {
    key,
    spine: chapters.map((_, i) => ({ path: `c${i}.xhtml`, size: 1 })),
    chapter: async (index: number): Promise<Chapter | Refusal> => {
      reads[index] = (reads[index] ?? 0) + 1;
      const paragraphs = chapters[index];
      if (!paragraphs) return { refused: 'damaged', detail: 'refused' };
      return {
        nodes: paragraphs.map((words) => ({
          kind: 'element',
          name: 'p',
          attrs: {},
          children: [{ kind: 'text', text: words }],
        })),
        images: [],
      };
    },
  } as unknown as Epub;
  return { epub, reads };
}

const words = (query: string) => matcherOf(query, AS_WRITTEN) as RegExp;
const now = (then: () => void) => then();

/** A search, told each time its matches change. */
function searching(texts = new BookTexts()) {
  const changed = vi.fn();
  return { search: new BookSearch({ texts, changed }), changed, texts };
}

afterEach(() => vi.useRealTimers());

describe('a book searched', () => {
  it('finds every match in the reading order, chapter by chapter, then says it’s through', async () => {
    const { epub } = book([['a bell rang'], ['no'], ['the bell, the bell']]);
    const { search } = searching();
    search.search(epub, words('bell'), now);
    await vi.waitFor(() => expect(search.done).toBe(true));
    expect(search.found.map((match) => [match.spine, match.from])).toEqual([
      [0, 2],
      [2, 4],
      [2, 14],
    ]);
    expect(search.searched).toBe(3);
  });

  it('reads each chapter once for the book, the next words searching what’s kept', async () => {
    const { epub, reads } = book([['a bell'], ['a ball']]);
    const { search } = searching();
    search.search(epub, words('bell'), now);
    await vi.waitFor(() => expect(search.done).toBe(true));
    search.search(epub, words('ball'), now);
    await vi.waitFor(() => expect(search.done).toBe(true));
    expect(search.found).toHaveLength(1);
    expect(reads).toEqual([1, 1]);
  });

  it('lets the last book’s chapters go when another is searched', async () => {
    const texts = new BookTexts();
    const one = book([['a bell']], 'one');
    const two = book([['a bell']], 'two');
    const { search } = searching(texts);
    search.search(one.epub, words('bell'), now);
    await vi.waitFor(() => expect(search.done).toBe(true));
    search.search(two.epub, words('bell'), now);
    await vi.waitFor(() => expect(search.done).toBe(true));
    search.search(one.epub, words('bell'), now);
    await vi.waitFor(() => expect(search.done).toBe(true));
    expect(one.reads).toEqual([2]);
  });

  it('passes over a chapter that won’t open', async () => {
    const { epub } = book([null, ['a bell']]);
    const { search } = searching();
    search.search(epub, words('bell'), now);
    await vi.waitFor(() => expect(search.done).toBe(true));
    expect(search.found.map((match) => match.spine)).toEqual([1]);
  });

  it('never searches while a page turns: each slice waits for the page to be still', async () => {
    const { epub, reads } = book([['a bell'], ['a bell']]);
    const { search } = searching();
    const waiting: (() => void)[] = [];
    search.search(epub, words('bell'), (then) => waiting.push(then));
    await vi.waitFor(() => expect(waiting).toHaveLength(1));
    expect(reads).toEqual([0, 0]);
    waiting.shift()?.();
    await vi.waitFor(() => expect(reads[0]).toBe(1));
    expect(search.done).toBe(false);
  });

  it('stops the last search when asked for another, which alone is told and kept', async () => {
    const { epub } = book([['a bell'], ['a bell'], ['a ball']]);
    const { search, changed } = searching();
    const waiting: (() => void)[] = [];
    search.search(epub, words('bell'), (then) => waiting.push(then));
    await vi.waitFor(() => expect(waiting).toHaveLength(1));
    search.search(epub, words('ball'), now);
    await vi.waitFor(() => expect(search.done).toBe(true));
    // The first search's slice, let through late, finds and tells nothing.
    changed.mockClear();
    waiting.shift()?.();
    await new Promise((done) => setTimeout(done, 10));
    expect(changed).not.toHaveBeenCalled();
    expect(search.found.map((match) => match.words)).toEqual(['ball']);
  });

  it('stops at the find bar’s limit, and says there are more', async () => {
    const many = Array.from({ length: COUNT_LIMIT + 50 }, () => 'e');
    const { epub } = book([many, ['e e e']]);
    const { search } = searching();
    search.search(epub, words('e'), now);
    await vi.waitFor(() => expect(search.done).toBe(true));
    expect(search.found).toHaveLength(COUNT_LIMIT);
    expect(search.more).toBe(true);
    expect(search.searched).toBe(1);
  });

  it('clears for no words, telling once', () => {
    const { search, changed } = searching();
    search.search(null, null, now);
    expect(search.found).toEqual([]);
    expect(search.done).toBe(true);
    expect(changed).toHaveBeenCalledOnce();
  });
});
