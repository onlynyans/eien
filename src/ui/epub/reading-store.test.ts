// The reading state's store (#40, Phase 4b, QA): a book's bookmarks changed
// after the place's writes, every page of the book told once a change is
// kept and never when it isn't, and a page that fails to show one never
// stopping the next from being told.

import { describe, expect, it, vi } from 'vitest';
import { type Bookmark, readingPath } from '../../core/epub';
import { MemoryStorage } from '../../platform/memory/memory-storage';
import { readingStore } from './reading-store';

const KEY = '0123456789abcdef';
const mark = (offset: number): Bookmark => ({ chapter: 'c1', offset, words: 'words' });

function store(before?: string) {
  const disk = new MemoryStorage();
  const told = vi.fn();
  const reading = readingStore(disk, told);
  const file = async () => (await disk.read(readingPath(KEY)))?.text ?? null;
  const ready = before ? disk.write(readingPath(KEY), before, null) : Promise.resolve();
  return { disk, reading, file, ready, told };
}

describe('a book’s bookmarks in the reading store', () => {
  it('are changed after a place written just before, neither lost', async () => {
    const { reading, file } = store();
    // Not awaited: the bookmark's change queues behind the place's write.
    void reading.write(KEY, { chapter: 'c2', offset: 40 });
    const after = await reading.mark(KEY, { add: mark(5) });
    expect(after).toEqual([mark(5)]);
    const kept = JSON.parse((await file()) ?? '{}');
    expect(kept.place).toEqual({ chapter: 'c2', offset: 40 });
    expect(kept.bookmarks).toEqual([mark(5)]);
    // A read asked for after them sees both.
    const read = await reading.read(KEY);
    expect(read).toMatchObject({ reading: { chapter: 'c2', offset: 40 }, kept: 'kept' });
    expect(read.bookmarks).toEqual([mark(5)]);
  });

  it('tell each page of the book once kept, and none of another book', async () => {
    const { reading } = store();
    const one = vi.fn();
    const two = vi.fn();
    const other = vi.fn();
    reading.listen(KEY, one);
    const stop = reading.listen(KEY, two);
    reading.listen('fedcba9876543210', other);
    await reading.mark(KEY, { add: mark(5) });
    expect(one).toHaveBeenCalledWith([mark(5)]);
    expect(two).toHaveBeenCalledWith([mark(5)]);
    expect(other).not.toHaveBeenCalled();
    // A page let go is told no more.
    stop();
    await reading.mark(KEY, { remove: [mark(5)] });
    expect(one).toHaveBeenLastCalledWith([]);
    expect(two).toHaveBeenCalledTimes(1);
  });

  it('a page that fails to show the change never stops another from being told, nor unkeeps it', async () => {
    const { reading, file } = store();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const after = vi.fn();
    reading.listen(KEY, () => {
      throw new Error('a page that fails');
    });
    reading.listen(KEY, after);
    expect(await reading.mark(KEY, { add: mark(5) })).toEqual([mark(5)]);
    expect(after).toHaveBeenCalledWith([mark(5)]);
    expect(JSON.parse((await file()) ?? '{}').bookmarks).toEqual([mark(5)]);
  });

  it('aren’t changed in a newer Eien’s file, nor one that can’t be read: null, no page told', async () => {
    for (const before of ['{ "version": 2, "bookmarks": [] }', '{ "bookmarks": [ broken']) {
      const { reading, file, ready } = store(before);
      await ready;
      const listener = vi.fn();
      reading.listen(KEY, listener);
      expect(await reading.mark(KEY, { add: mark(5) }), before).toBeNull();
      expect(listener).not.toHaveBeenCalled();
      expect(await file()).toBe(before);
    }
  });

  it('a write the vault refuses is null, and the next change is still made', async () => {
    const { disk, reading, file } = store();
    const write = vi.spyOn(disk, 'write').mockRejectedValueOnce(new Error('the disk is full'));
    expect(await reading.mark(KEY, { add: mark(5) })).toBeNull();
    write.mockRestore();
    expect(await reading.mark(KEY, { add: mark(9) })).toEqual([mark(9)]);
    expect(JSON.parse((await file()) ?? '{}').bookmarks).toEqual([mark(9)]);
  });
});
