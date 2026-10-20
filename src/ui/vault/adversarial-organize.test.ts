// Adversarial: the Organizer (phase 6b) over a vault in memory, with the
// open note's real session, the real index and the vault state the window
// keeps — what the vault view wires together.

import { describe, expect, it } from 'vitest';
import type { VaultBridge } from '../../platform/bridge';
import { VaultIndex } from '../../platform/index';
import { MemoryStorage } from '../../platform/memory/memory-storage';
import { NoteSession } from '../notes/note-session';
import { Organizer } from './organize';
import { VaultState } from './vault-state';

/** A vault as the window sees it, an Organizer over it, and the note it has open. */
async function vaultWith(files: Record<string, string>) {
  const storage = new MemoryStorage();
  for (const [path, text] of Object.entries(files)) storage.put(path, text);
  const index = new VaultIndex(storage);
  /** What reached the system's trash, with the words it held. */
  const trashed = new Map<string, string | null>();
  const told: string[] = [];
  let session: NoteSession | null = null;
  const vault: VaultBridge = {
    current: async () => ({ name: 'V' }),
    choose: async () => null,
    list: async () => index.entries(),
    notes: async () => index.notes(),
    search: async (query) => index.search(query),
    read: (path) => storage.read(path),
    readBytes: (path) => storage.readBytes(path),
    write: async (path, text, expected) => {
      const result = await storage.write(path, text, expected);
      if (result.ok) await index.refresh([path]);
      return result;
    },
    move: async (from, to) => {
      const result = await storage.move(from, to);
      if (result.ok) await index.refresh([from, to]);
      return result;
    },
    trash: async (path) => {
      trashed.set(path, (await storage.read(path))?.text ?? null);
      await storage.trash(path);
      await index.refresh([path]);
    },
    makeFolder: async (path) => {
      await storage.makeFolder(path);
      await index.refresh([path]);
    },
    onChange: () => () => {},
  };
  const state = new VaultState(vault, 'V');
  const organizer = new Organizer({
    vault,
    state,
    trashName: 'the trash',
    session: () => session,
    closed: () => {
      session = null;
    },
    tell: (message) => told.push(message),
  });
  await index.refresh();
  await state.refresh();
  return {
    storage,
    state,
    organizer,
    trashed,
    told,
    open: async (path: string) => {
      session = await NoteSession.open(vault, path, {
        status: () => {},
        replaced: () => {},
        movedToCopy: () => {},
        gone: () => {},
      });
      return session as NoteSession;
    },
    refresh: async () => {
      await index.refresh();
      await state.refresh();
    },
  };
}

describe('Organizer, adversarial', () => {
  it('never sends the open note to the trash without its last words when they couldn’t be saved', async () => {
    const v = await vaultWith({ 'Chapter.md': 'The words saved this morning.' });
    const session = await v.open('Chapter.md');
    // The disk is full: the next save fails, and the page says "Not saved yet — trying again".
    const write = v.storage.write.bind(v.storage);
    v.storage.write = async () => {
      throw new Error('ENOSPC: no space left on device');
    };
    session.edit('The words saved this morning. And an afternoon’s more.');
    const sent = await v.organizer.trash('Chapter.md');
    v.storage.write = write;
    // organize.ts: "its last words go to the trash with it". Either the trash is refused while
    // they're unsaved, or what went to the trash holds them.
    const inTrash = v.trashed.get('Chapter.md') ?? '';
    const lost = sent && !inTrash.includes('afternoon');
    expect(lost, `trashed: ${sent}; the trash holds "${inTrash}"; told: ${v.told}`).toBe(false);
  });

  it('keeps a chapter’s place in the book when it’s renamed, though the order names it in another case', async () => {
    // The order was written when the file was "chapter two.md"; it was recapitalised since
    // (another device, or Finder). orderNames still places it, case aside (folder-settings.ts).
    const v = await vaultWith({
      'Book/Chapter Two.md': 'two',
      'Book/Chapter One.md': 'one',
      'Book/.eien-folder.json': '{"order":["chapter two.md","Chapter One.md"],"book":{}}',
    });
    expect(await v.state.folderOrder('Book')).toEqual(['Chapter Two.md', 'Chapter One.md']);
    expect(await v.organizer.renameNote('Book/Chapter Two.md', 'Prologue')).toBe(
      'Book/Prologue.md',
    );
    await v.refresh();
    expect(await v.state.folderOrder('Book')).toEqual(['Prologue.md', 'Chapter One.md']);
  });

  it('drops names that aren’t there from the order it writes (spec §2)', async () => {
    const v = await vaultWith({
      'Loose.md': 'loose',
      'Book/A.md': 'a',
      'Book/.eien-folder.json': '{"order":["Deleted elsewhere.md","A.md"],"book":{}}',
    });
    await v.organizer.moveInto('Loose.md', 'Book', true);
    const { order } = JSON.parse((await v.storage.read('Book/.eien-folder.json'))?.text ?? '{}');
    expect(order).toEqual(['A.md', 'Loose.md']);
  });
});
