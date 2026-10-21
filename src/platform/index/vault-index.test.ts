// The vault index over a storage that can lie about times and sizes, fail
// on cue, and count what it's asked.

import { describe, expect, it } from 'vitest';
import type { VaultEntry } from '../../core/vault';
import { MemoryStorage } from '../memory/memory-storage';
import type { FileState, Storage, WriteResult } from '../storage';
import { MAX_NOTE_BYTES, VaultIndex } from './index';

/** A MemoryStorage that the test can bend. */
class BentStorage implements Storage {
  readonly inner = new MemoryStorage();
  reads = 0;
  lists = 0;
  readingNow = 0;
  mostAtOnce = 0;
  /** Listed times and sizes, instead of the real ones. */
  readonly stamps = new Map<string, { modified: number; size: number }>();
  failList = false;
  readonly failRead = new Set<string>();
  /** Listed, but gone by the time they're read. */
  readonly ghosts = new Set<string>();

  async list(): Promise<VaultEntry[]> {
    this.lists++;
    if (this.failList) throw new Error('the vault went away');
    const entries = await this.inner.list();
    const ghosts = [...this.ghosts].map(
      (path): VaultEntry => ({ path, kind: 'note', modified: 1, size: 1 }),
    );
    return [...entries, ...ghosts].map((entry) => ({ ...entry, ...this.stamps.get(entry.path) }));
  }
  listFiles(folder: string): Promise<string[]> {
    return this.inner.listFiles(folder);
  }
  writeNew(path: string, bytes: Uint8Array): Promise<boolean> {
    return this.inner.writeNew(path, bytes);
  }
  async read(path: string): Promise<FileState | null> {
    this.reads++;
    this.readingNow++;
    this.mostAtOnce = Math.max(this.mostAtOnce, this.readingNow);
    try {
      await new Promise((settle) => setTimeout(settle, 1));
      if (this.failRead.has(path)) throw new Error('locked');
      return this.inner.read(path);
    } finally {
      this.readingNow--;
    }
  }
  readBytes(path: string): Promise<Uint8Array | null> {
    return this.inner.readBytes(path);
  }
  write(path: string, text: string, expected: string | null): Promise<WriteResult> {
    return this.inner.write(path, text, expected);
  }
  move(from: string, to: string) {
    return this.inner.move(from, to);
  }
  trash(path: string) {
    return this.inner.trash(path);
  }
  makeFolder(path: string) {
    return this.inner.makeFolder(path);
  }
  watch(onChange: (paths: string[]) => void): () => void {
    return this.inner.watch(onChange);
  }
}

const vault = (files: Record<string, string>) => {
  const storage = new BentStorage();
  for (const [path, text] of Object.entries(files)) storage.inner.put(path, text);
  return { storage, index: new VaultIndex(storage) };
};

describe('VaultIndex', () => {
  it('lists every note with its preview, words and tags, and every folder', async () => {
    const { index } = vault({
      'Fic/Scarf/Seventeen.md': '# Seventeen\n\n"Look," he begins. #draft',
      'Ideas.md': '---\ntags: [winter]\n---\nSnow on the walls.',
      'cover.png': 'not a note',
    });
    await index.refresh();
    expect(index.entries().map((entry) => [entry.path, entry.kind])).toEqual(
      expect.arrayContaining([
        ['Fic', 'folder'],
        ['Fic/Scarf', 'folder'],
        ['Fic/Scarf/Seventeen.md', 'note'],
        ['Ideas.md', 'note'],
        ['cover.png', 'file'],
      ]),
    );
    const notes = Object.fromEntries(index.notes().map((note) => [note.path, note]));
    expect(notes['Fic/Scarf/Seventeen.md']).toMatchObject({
      preview: '"Look," he begins. #draft',
      words: 5,
      tags: ['draft'],
    });
    expect(notes['Ideas.md']).toMatchObject({ preview: 'Snow on the walls.', tags: ['winter'] });
    expect(notes['cover.png']).toBeUndefined();
  });

  it('reads again only what changed, or what the watcher named', async () => {
    const { storage, index } = vault({ 'a.md': 'one', 'b.md': 'two', 'c.md': 'three' });
    await index.refresh();
    expect(storage.reads).toBe(3);

    await index.refresh();
    expect(storage.reads).toBe(3); // nothing changed: nothing read

    storage.inner.put('b.md', 'two, changed');
    await index.refresh();
    expect(storage.reads).toBe(4);

    // Changed within the same moment, to the same size: the stamps can't tell, the watcher can.
    storage.stamps.set('c.md', { modified: 5, size: 5 });
    await index.refresh();
    const before = storage.reads;
    storage.inner.put('c.md', 'THREE');
    storage.stamps.set('c.md', { modified: 5, size: 5 });
    await index.refresh();
    expect(storage.reads).toBe(before); // looks the same
    await index.refresh(['c.md']);
    expect(storage.reads).toBe(before + 1);
    expect(index.notes().find((note) => note.path === 'c.md')?.preview).toBe('THREE');
  });

  it('forgets a deleted note, and finds a renamed one under its new name', async () => {
    const { storage, index } = vault({ 'a.md': 'one', 'b.md': 'two' });
    await index.refresh();
    storage.inner.remove('a.md');
    storage.inner.remove('b.md');
    storage.inner.put('B renamed.md', 'two');
    await index.refresh();
    expect(index.notes().map((note) => note.path)).toEqual(['B renamed.md']);
    expect(index.entries().map((entry) => entry.path)).toEqual(['B renamed.md']);
  });

  it('leaves out a note that vanished between the listing and the read', async () => {
    const { storage, index } = vault({ 'here.md': 'x' });
    storage.ghosts.add('gone.md');
    await index.refresh();
    expect(index.notes().map((note) => note.path)).toEqual(['here.md']);
    expect(index.entries().map((entry) => entry.path)).toEqual(['here.md']);
  });

  it('lists an unreadable note by name, and reads it once it can', async () => {
    const { storage, index } = vault({ 'locked.md': 'secret words' });
    storage.failRead.add('locked.md');
    await index.refresh();
    expect(index.notes()).toEqual([
      expect.objectContaining({ path: 'locked.md', preview: '', words: 0 }),
    ]);
    expect(index.search('locked').total).toBe(1); // still found by its title
    storage.failRead.clear();
    await index.refresh(['locked.md']);
    expect(index.notes()[0]?.preview).toBe('secret words');
  });

  it('lists a huge note without reading it', async () => {
    const { storage, index } = vault({ 'huge.md': 'x' });
    storage.stamps.set('huge.md', { modified: 1, size: MAX_NOTE_BYTES + 1 });
    await index.refresh();
    expect(storage.reads).toBe(0);
    expect(index.notes()).toEqual([expect.objectContaining({ path: 'huge.md', words: 0 })]);
  });

  it('reads at most sixteen notes at once', async () => {
    const files = Object.fromEntries(
      Array.from({ length: 100 }, (_, i) => [`n${i}.md`, `note ${i}`]),
    );
    const { storage, index } = vault(files);
    await index.refresh();
    expect(storage.reads).toBe(100);
    expect(storage.mostAtOnce).toBeLessThanOrEqual(16);
    expect(storage.mostAtOnce).toBeGreaterThan(1);
  });

  it('runs a burst of refreshes as one more, never two at once', async () => {
    const { storage, index } = vault({ 'a.md': 'x' });
    const burst = [index.refresh(), index.refresh(['a.md']), index.refresh(), index.refresh()];
    await Promise.all(burst);
    expect(storage.lists).toBe(2);
    expect(storage.reads).toBe(2); // the first run, then a.md again as named
  });

  it('keeps what it knew when listing fails, and remembers what to read for next time', async () => {
    const { storage, index } = vault({ 'a.md': 'old' });
    await index.refresh();
    storage.failList = true;
    storage.inner.put('a.md', 'new');
    storage.stamps.set('a.md', { modified: 1, size: 3 });
    await expect(index.refresh(['a.md'])).rejects.toThrow('the vault went away');
    expect(index.notes()[0]?.preview).toBe('old');
    storage.failList = false;
    await index.refresh(); // a.md was named before the failure: it's still read
    expect(index.notes()[0]?.preview).toBe('new');
  });
});

describe('VaultIndex search', () => {
  const searchable = async () => {
    const { storage, index } = vault({
      'Old scarf.md': 'Nothing here.',
      'Notes.md': 'The scarf, mended.',
      'Newer.md': 'Another scarf.',
      'Café.md': 'Le café, la nuit.',
    });
    // Newer.md is the most recently changed.
    storage.stamps.set('Newer.md', { modified: 9e12, size: 14 });
    await index.refresh();
    return index;
  };

  it('puts notes titled with the words first, then the most recently changed', async () => {
    const index = await searchable();
    expect(index.search('scarf').hits.map((hit) => hit.path)).toEqual([
      'Old scarf.md',
      'Newer.md',
      'Notes.md',
    ]);
  });

  it('counts every match but returns at most the limit', async () => {
    const index = await searchable();
    const result = index.search('scarf', 2);
    expect(result.total).toBe(3);
    expect(result.hits).toHaveLength(2);
  });

  it('shows a snippet of where the words are', async () => {
    const index = await searchable();
    expect(index.search('mended').hits).toEqual([
      { path: 'Notes.md', snippet: 'The scarf, mended.' },
    ]);
    expect(index.search('cafe nuit').hits.map((hit) => hit.path)).toEqual(['Café.md']);
  });

  it('searches only the notes it is given, when it is given some', async () => {
    const index = await searchable();
    const within = ['Notes.md', 'Café.md', 'Gone.md'];
    expect(index.search('scarf', 200, within)).toEqual({
      total: 1,
      hits: [{ path: 'Notes.md', snippet: 'The scarf, mended.' }],
    });
    expect(index.search('scarf', 200, []).total).toBe(0);
    expect(index.search('scarf', 200, null).total).toBe(3);
  });

  it('finds nothing for an empty query, or before the first refresh', async () => {
    const index = await searchable();
    expect(index.search('   ')).toEqual({ total: 0, hits: [] });
    expect(new VaultIndex(new MemoryStorage()).search('scarf')).toEqual({ total: 0, hits: [] });
  });
});
