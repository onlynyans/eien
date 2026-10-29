// A note's own folder of images goes where the note goes: the Organizer
// over a vault in memory, with the real index and vault state, as the vault
// view wires them.

import { describe, expect, it } from 'vitest';
import type { VaultBridge } from '../../platform/bridge';
import { VaultIndex } from '../../platform/index';
import { MemoryStorage } from '../../platform/memory/memory-storage';
import { NoteSession } from '../notes/note-session';
import { Organizer } from './organize';
import { VaultState } from './vault-state';

const PNG = new Uint8Array([137, 80, 78, 71]);

async function vaultWith(files: Record<string, string>, images: readonly string[] = []) {
  const storage = new MemoryStorage();
  for (const [path, text] of Object.entries(files)) storage.put(path, text);
  for (const path of images) await storage.writeNew(path, PNG);
  const index = new VaultIndex(storage);
  const told: string[] = [];
  let session: NoteSession | null = null;
  const after = async <T>(result: T, ...paths: string[]) => {
    await index.refresh(paths);
    return result;
  };
  const vault: VaultBridge = {
    current: async () => ({ name: 'V' }),
    choose: async () => null,
    importFolder: async () => null,
    list: async () => index.entries(),
    notes: async () => index.notes(),
    search: async (query) => index.search(query),
    listFiles: (folder) => storage.listFiles(folder),
    read: (path) => storage.read(path),
    readBytes: (path) => storage.readBytes(path),
    write: async (path, text, expected) => after(await storage.write(path, text, expected), path),
    writeNew: async (path, bytes) => after(await storage.writeNew(path, bytes), path),
    move: async (from, to) => after(await storage.move(from, to), from, to),
    trash: async (path) => after(await storage.trash(path), path),
    makeFolder: async (path) => after(await storage.makeFolder(path), path),
    onChange: () => () => {},
  };
  const state = new VaultState(vault, 'V');
  const organizer = new Organizer({
    vault,
    state,
    trashName: 'the trash',
    sessions: () => (session ? [session] : []),
    closed: () => {
      session = null;
    },
    tell: (message) => told.push(message),
    // As the vault view does it, with no editor: the session takes the changed words and saves.
    amendOpen: async (path, change) => {
      if (!session || session.path !== path) return null;
      session.edit(change(session.text));
      await session.flush();
      return session.state === 'saved';
    },
  });
  await index.refresh();
  await state.refresh();
  const text = async (path: string) => (await storage.read(path))?.text ?? null;
  const open = async (path: string) => {
    session = await NoteSession.open(vault, path, {
      status: () => {},
      replaced: () => {},
      movedToCopy: () => {},
      gone: () => {},
    });
    return session as NoteSession;
  };
  return { storage, vault, state, organizer, told, text, open };
}

const NOTE = 'A scarf.\n\n![](Chapter%203.assets/scarf.png)\n\n![](cover.png)\n';

describe('a note’s images', () => {
  it('are renamed with it, and its links follow', async () => {
    const v = await vaultWith({ 'Fic/Chapter 3.md': NOTE }, ['Fic/Chapter 3.assets/scarf.png']);
    expect(await v.organizer.renameFile('Fic/Chapter 3.md', 'The Fire')).toBe('Fic/The Fire.md');
    expect(await v.storage.readBytes('Fic/The Fire.assets/scarf.png')).toEqual(PNG);
    expect(await v.storage.readBytes('Fic/Chapter 3.assets/scarf.png')).toBeNull();
    expect(await v.text('Fic/The Fire.md')).toBe(
      'A scarf.\n\n![](The%20Fire.assets/scarf.png)\n\n![](cover.png)\n',
    );
    expect(v.told).toEqual([]);
  });

  it('follow the open note, its links changed on the page and saved', async () => {
    const v = await vaultWith({ 'Chapter 3.md': NOTE }, ['Chapter 3.assets/scarf.png']);
    const session = await v.open('Chapter 3.md');
    expect(await v.organizer.renameFile('Chapter 3.md', 'Four')).toBe('Four.md');
    expect(session.path).toBe('Four.md');
    expect(session.text).toContain('![](Four.assets/scarf.png)');
    expect(await v.text('Four.md')).toContain('![](Four.assets/scarf.png)');
  });

  it('move into another folder with it, under its new name there', async () => {
    const v = await vaultWith({ 'Chapter 3.md': NOTE, 'Book/Chapter 3.md': 'Another.' }, [
      'Chapter 3.assets/scarf.png',
    ]);
    expect(await v.organizer.moveInto('Chapter 3.md', 'Book', true)).toBe('Book/Chapter 3 2.md');
    expect(await v.storage.readBytes('Book/Chapter 3 2.assets/scarf.png')).toEqual(PNG);
    expect(await v.text('Book/Chapter 3 2.md')).toContain('![](Chapter%203%202.assets/scarf.png)');
  });

  it('go to the trash with it, and the writer is told', async () => {
    const v = await vaultWith({ 'Chapter 3.md': NOTE }, ['Chapter 3.assets/scarf.png']);
    expect(await v.organizer.trash('Chapter 3.md')).toBe(true);
    expect(v.storage.trashed).toEqual(['Chapter 3.md', 'Chapter 3.assets']);
    expect(v.told).toEqual(['“Chapter 3” and its images are in the trash.']);
  });

  it('stay where they are when their folder’s new name is taken, and the writer is told', async () => {
    const v = await vaultWith({ 'Chapter 3.md': NOTE }, [
      'Chapter 3.assets/scarf.png',
      'Four.assets/someone else.png',
    ]);
    expect(await v.organizer.renameFile('Chapter 3.md', 'Four')).toBe('Four.md');
    expect(await v.storage.readBytes('Chapter 3.assets/scarf.png')).toEqual(PNG);
    expect(await v.text('Four.md')).toBe(NOTE); // still finds nothing new: nothing to point at
    expect(v.told).toEqual(['“Four” moved, but its images stayed in “Chapter 3.assets”.']);
  });

  it('are nothing to say for a note that has none', async () => {
    const v = await vaultWith({ 'Plain.md': 'Words.' });
    expect(await v.organizer.renameFile('Plain.md', 'Other')).toBe('Other.md');
    await v.organizer.trash('Other.md');
    expect(v.told).toEqual(['“Other” is in the trash.']);
  });

  it('are hidden from the tree while the note is beside them', async () => {
    const v = await vaultWith({ 'Chapter 3.md': NOTE }, ['Chapter 3.assets/scarf.png']);
    expect(v.state.tree.folders).toEqual([]);
  });
});

describe('a book on SHELF is no note (#40)', () => {
  const BOOK = 'Novels/Dune.epub';

  it('keeps its .epub, renamed or moved, and never takes a folder named like it along', async () => {
    const v = await vaultWith({ [BOOK]: 'PK', 'Novels/Dune.md': 'Notes on it.\n' }, [
      'Novels/Dune.epub.assets/map.png',
      'Novels/Dune.assets/map.png',
    ]);
    expect(await v.organizer.renameFile(BOOK, 'Arrakis')).toBe('Novels/Arrakis.epub');
    expect(await v.organizer.moveInto('Novels/Arrakis.epub', '', true)).toBe('Arrakis.epub');
    await v.state.refresh();
    expect(v.state.has('Novels/Dune.epub.assets/map.png')).toBe(true);
    expect(v.state.has('Novels/Dune.assets/map.png')).toBe(true);
    expect(await v.text('Novels/Dune.md')).toBe('Notes on it.\n');
    expect(v.told).toEqual([]);
  });

  it('takes no place in a folder’s own order, moved into it: the order’s file isn’t written', async () => {
    const order = '{"order":["Two.md","One.md"]}';
    const v = await vaultWith({
      [BOOK]: 'PK',
      'Fic/One.md': 'One.\n',
      'Fic/Two.md': 'Two.\n',
      'Fic/.eien-folder.json': order,
    });
    expect(await v.organizer.moveInto(BOOK, 'Fic', true)).toBe('Fic/Dune.epub');
    expect(await v.text('Fic/.eien-folder.json')).toBe(order);
  });

  it('goes to the trash, the writer told where by its title; nothing else goes with it', async () => {
    const v = await vaultWith({ [BOOK]: 'PK' }, ['Novels/Dune.epub.assets/map.png']);
    expect(await v.organizer.trash(BOOK)).toBe(true);
    expect(v.storage.trashed).toEqual([BOOK]);
    expect(v.told).toEqual(['“Dune” is in the trash.']);
  });

  it('stays where it is when the trash fails: nothing deleted, and the writer told', async () => {
    const v = await vaultWith({ [BOOK]: 'PK' });
    v.vault.trash = async () => {
      throw new Error('The trash is full.');
    };
    expect(await v.organizer.trash(BOOK)).toBe(false);
    expect(await v.text(BOOK)).toBe('PK');
    expect(v.told).toEqual([
      '“Dune” couldn’t go to the trash, so nothing was deleted: The trash is full.',
    ]);
  });
});
