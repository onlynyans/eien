// Adversarial: the open note when another program rewrites the file with the
// same words but other bytes (line endings, a byte-order mark). The editor's
// text is unchanged, so the decision is "none" — but the file's version did
// change, and every later save is refused against the old one.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryStorage } from '../../platform/memory/memory-storage';
import { type NoteEvents, NoteSession, SAVE_AFTER_MS } from './note-session';

const quiet: NoteEvents = {
  status: () => {},
  replaced: () => {},
  movedToCopy: () => {},
  gone: () => {},
};

async function open(raw: string) {
  const vault = new MemoryStorage();
  vault.put('Note.md', raw);
  const session = await NoteSession.open(vault, 'Note.md', quiet);
  if (!session) throw new Error('no session');
  return { vault, session };
}

/** Every file's text, so a test can see whether the words reached the disk anywhere. */
const allText = async (vault: MemoryStorage) =>
  Promise.all((await vault.list()).map(async (entry) => (await vault.read(entry.path))?.text));

describe('NoteSession after a same-words rewrite elsewhere', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    ['its line endings changed to CRLF', 'One.\n', 'One.\r\n'],
    ['its line endings changed to LF', 'One.\r\n', 'One.\n'],
    ['a byte-order mark added', 'One.\n', '﻿One.\n'],
  ])('still saves what is typed after the file had %s', async (_, before, after) => {
    const { vault, session } = await open(before);
    vault.put('Note.md', after); // another editor saved the same words in its own format
    await session.diskChanged();
    session.edit('One.\nTwo.\n');
    await vi.advanceTimersByTimeAsync(SAVE_AFTER_MS * 10);
    await session.flush(); // as on quitting
    const texts = await allText(vault);
    expect(texts.some((text) => text?.includes('Two.'))).toBe(true);
    expect(session.state).toBe('saved');
  });

  it('still saves when the watcher never reported the rewrite', async () => {
    const { vault, session } = await open('One.\n');
    vault.put('Note.md', 'One.\r\n');
    session.edit('One.\nTwo.\n');
    await session.flush();
    const texts = await allText(vault);
    expect(texts.some((text) => text?.includes('Two.'))).toBe(true);
  });
});
