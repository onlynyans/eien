// The window's open notes: one session and one document per note, however
// many pages hold it (the split's two sides), let go with the last of them.

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { VaultBridge } from '../../platform/bridge';
import { MemoryStorage } from '../../platform/memory/memory-storage';
import { SAVE_AFTER_MS, type SaveState } from '../notes/note-session';
import { type NoteHolder, OpenNotes } from './open-notes';

/** A vault in memory, counting the reads of each note. */
function vaultOf(files: Record<string, string>) {
  const storage = new MemoryStorage();
  for (const [path, text] of Object.entries(files)) storage.put(path, text);
  const reads: string[] = [];
  const vault = {
    read: (path: string) => {
      reads.push(path);
      return storage.read(path);
    },
    write: (path: string, text: string, expected: string | null) =>
      storage.write(path, text, expected),
    list: () => storage.list(),
    readBytes: (path: string) => storage.readBytes(path),
  } as unknown as VaultBridge;
  return { storage, vault, reads };
}

/** A page holding a note: what it was told. */
function holder() {
  const told: string[] = [];
  const page: NoteHolder & { told: string[] } = {
    told,
    status: (state: SaveState) => told.push(`status ${state}`),
    reloaded: (text) => told.push(`reloaded ${text}`),
    movedToCopy: (copy) => told.push(`copy ${copy}`),
    gone: () => told.push('gone'),
    moved: () => told.push('moved'),
  };
  return page;
}

afterEach(() => {
  vi.useRealTimers();
});

describe('a note on two pages', () => {
  it('is read once, and both pages hold the one session and the one document', async () => {
    const { vault, reads } = vaultOf({ 'Fic/Snow.md': 'Snow fell.' });
    const notes = new OpenNotes(vault, () => {});
    const [a, b] = await Promise.all([
      notes.take('Fic/Snow.md', holder()),
      notes.take('Fic/Snow.md', holder()),
    ]);
    expect(a).not.toBeNull();
    expect(b).toBe(a);
    expect(reads).toEqual(['Fic/Snow.md']);
    expect(notes.sessions()).toHaveLength(1);
    expect(notes.session('Fic/Snow.md')?.text).toBe('Snow fell.');
  });

  it('keeps saving while one page still holds it, and closes it with the last', async () => {
    vi.useFakeTimers();
    const { storage, vault } = vaultOf({ 'Snow.md': 'Snow.' });
    const notes = new OpenNotes(vault, () => {});
    const left = holder();
    const right = holder();
    const entry = await notes.take('Snow.md', left);
    await notes.take('Snow.md', right);
    if (!entry) throw new Error('not opened');
    notes.release(entry, left);
    entry.session.edit('Snow. Still held.');
    await vi.advanceTimersByTimeAsync(SAVE_AFTER_MS + 10);
    expect((await storage.read('Snow.md'))?.text).toBe('Snow. Still held.');
    expect(right.told).toContain('status saved');

    notes.release(entry, right);
    expect(notes.sessions()).toEqual([]);
    entry.session.edit('Typed after it closed.');
    await vi.advanceTimersByTimeAsync(SAVE_AFTER_MS + 10);
    expect((await storage.read('Snow.md'))?.text).toBe('Snow. Still held.');
  });

  it('takes a change from another device into the document once, and tells every page', async () => {
    const { storage, vault } = vaultOf({ 'Snow.md': 'Snow.' });
    const notes = new OpenNotes(vault, () => {});
    const left = holder();
    const right = holder();
    const entry = await notes.take('Snow.md', left);
    await notes.take('Snow.md', right);
    const replace = vi.spyOn(entry?.doc as NonNullable<typeof entry>['doc'], 'replace');
    storage.put('Snow.md', 'Rain, from the laptop.');
    notes.diskChanged(new Set(['Snow.md']));
    await vi.waitFor(() => expect(right.told).toContain('reloaded Rain, from the laptop.'));
    expect(left.told).toContain('reloaded Rain, from the laptop.');
    expect(replace).toHaveBeenCalledTimes(1);
    expect(entry?.doc.text).toBe('Rain, from the laptop.');
  });

  it('tells every page when the note is gone from the disk', async () => {
    const { storage, vault } = vaultOf({ 'Snow.md': 'Snow.' });
    const notes = new OpenNotes(vault, () => {});
    const left = holder();
    const right = holder();
    await notes.take('Snow.md', left);
    await notes.take('Snow.md', right);
    storage.remove('Snow.md');
    notes.diskChanged(new Set(['Snow.md']));
    await vi.waitFor(() => expect(right.told).toContain('gone'));
    expect(left.told).toContain('gone');
  });
});

describe('an open note moved by this window', () => {
  it('is kept under its new path, and its pages are told', async () => {
    const { vault } = vaultOf({ 'Fic/Snow.md': 'Snow.' });
    const notes = new OpenNotes(vault, () => {});
    const page = holder();
    const entry = await notes.take('Fic/Snow.md', page);
    if (!entry) throw new Error('not opened');
    const images = entry.images;
    entry.session.movedTo('Fic/Winter.md'); // renamed in its folder
    notes.followMoves();
    expect(notes.session('Fic/Winter.md')).toBe(entry.session);
    expect(notes.session('Fic/Snow.md')).toBeNull();
    expect(entry.images).toBe(images); // the same folder: its images are where they were
    expect(page.told).toEqual(['moved']);

    entry.session.movedTo('Drafts/Winter.md'); // into another folder
    notes.followMoves();
    expect(entry.images).not.toBe(images);
    expect(page.told).toEqual(['moved', 'moved']);
  });

  it('tells nothing when nothing moved', async () => {
    const { vault } = vaultOf({ 'Snow.md': 'Snow.' });
    const notes = new OpenNotes(vault, () => {});
    const page = holder();
    await notes.take('Snow.md', page);
    notes.followMoves();
    expect(page.told).toEqual([]);
  });
});

describe('a note that isn’t there', () => {
  it('opens as nothing, and leaves nothing held', async () => {
    const { vault } = vaultOf({});
    const notes = new OpenNotes(vault, () => {});
    expect(await notes.take('Gone.md', holder())).toBeNull();
    expect(notes.sessions()).toEqual([]);
  });
});
