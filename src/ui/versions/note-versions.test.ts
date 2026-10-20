// Seals (spec §9) over a vault in memory, with the open note played by a
// target that keeps its text and saves it as the page and session would.

import { describe, expect, it } from 'vitest';
import { isHiddenName } from '../../core/paths';
import { noteIdOf, type VersionFile } from '../../core/versions';
import { MemoryStorage } from '../../platform/memory/memory-storage';
import { NoteVersions, type SealTarget } from './note-versions';

const START = Date.UTC(2026, 9, 20, 12, 0, 0);

function vaultWith(files: Record<string, string>) {
  const storage = new MemoryStorage();
  for (const [path, text] of Object.entries(files)) storage.put(path, text);
  let clock = START;
  let ids = 0;
  const versions = new NoteVersions({
    vault: {
      listFiles: (folder) => storage.listFiles(folder),
      read: (path) => storage.read(path),
      write: (path, text, expected) => storage.write(path, text, expected),
      move: (from, to) => storage.move(from, to),
      trash: (path) => storage.trash(path),
    },
    notesWithId: (id) => listed.filter((path) => noteIdOf(texts.get(path) ?? '') === id),
    // Ten bytes, a new pattern each time: ids "A000000000", "B111111111"…
    random: () => new Uint8Array(10).fill(ids++),
    now: () => clock,
    dayOf: (at) => new Date(at).toISOString().slice(0, 10),
  });
  /** What the index knows: every visible note's text. */
  const texts = new Map<string, string>();
  let listed: string[] = [];
  const reindex = async () => {
    listed = [];
    for (const entry of await storage.list()) {
      if (entry.kind !== 'note' || entry.path.split('/').some(isHiddenName)) continue;
      listed.push(entry.path);
      texts.set(entry.path, (await storage.read(entry.path))?.text ?? '');
    }
  };
  /** The open note at `path`, its text in the editor; `failSaves` plays a full disk. */
  const open = async (path: string) => {
    await reindex();
    let text = (await storage.read(path))?.text ?? '';
    let saved = text;
    const state = { failSaves: false, open: true };
    const target: SealTarget & { type(next: string): void; state: typeof state } = {
      path,
      state,
      open: () => state.open,
      text: () => text,
      type: (next) => {
        text = next;
      },
      amend: async (change) => {
        const next = state.open ? change(text) : null;
        if (next === null) return false;
        text = next;
        return target.save();
      },
      save: async () => {
        if (state.failSaves || !state.open) return false;
        if (text === saved) return true;
        const current = await storage.read(path);
        const written = await storage.write(path, text, current?.version ?? null);
        if (written.ok) saved = text;
        await reindex();
        return written.ok;
      },
    };
    return target;
  };
  const sealFiles = async (id: string) => (await storage.listFiles(`.eien/versions/${id}`)).sort();
  return {
    storage,
    versions,
    open,
    sealFiles,
    tick: (ms: number) => {
      clock += ms;
    },
    read: async (path: string) => (await storage.read(path))?.text ?? null,
  };
}

const sealed = (result: Awaited<ReturnType<NoteVersions['seal']>>) => {
  if (result.kind !== 'sealed') throw new Error(`not sealed: ${JSON.stringify(result)}`);
  return result;
};

describe('sealing', () => {
  it('gives a note its id on its first seal, in front matter it didn’t have, and keeps a copy', async () => {
    const v = vaultWith({ 'Scarf.md': 'The scarf tore.' });
    const note = await v.open('Scarf.md');
    const result = sealed(await v.versions.seal(note));
    expect(result.id).toBe('A000000000');
    const text = '---\nid: A000000000\n---\nThe scarf tore.';
    expect(await v.read('Scarf.md')).toBe(text);
    expect(await v.sealFiles(result.id)).toEqual(['2026-10-20T12-00-00Z.md']);
    expect(await v.versions.text(result.id, result.version)).toBe(text);
  });

  it('keeps every other key of the front matter byte for byte', async () => {
    const front = '---\n# mine\ntags:   [fic,  draft]\n---\nWords.';
    const v = vaultWith({ 'Note.md': front });
    const note = await v.open('Note.md');
    sealed(await v.versions.seal(note));
    expect(await v.read('Note.md')).toBe(
      `---\nid: A000000000\n# mine\ntags:   [fic,  draft]\n---\nWords.`,
    );
  });

  it('makes nothing when the note is as its last seal; a change makes the next one', async () => {
    const v = vaultWith({ 'Note.md': '---\nid: KEEP123\n---\nOne.' });
    const note = await v.open('Note.md');
    sealed(await v.versions.seal(note));
    v.tick(5000);
    expect(await v.versions.seal(note)).toMatchObject({ kind: 'same', id: 'KEEP123' });
    note.type('---\nid: KEEP123\n---\nOne. Two.');
    sealed(await v.versions.seal(note));
    expect(await v.sealFiles('KEEP123')).toEqual([
      '2026-10-20T12-00-00Z.md',
      '2026-10-20T12-00-05Z.md',
    ]);
    expect(await v.read('Note.md')).toBe('---\nid: KEEP123\n---\nOne. Two.'); // saved as it's sealed
  });

  it('counts a second seal in the same second instead of writing over the first', async () => {
    const v = vaultWith({ 'Note.md': '---\nid: SAME\n---\nOne.' });
    const note = await v.open('Note.md');
    sealed(await v.versions.seal(note));
    note.type('---\nid: SAME\n---\nOne, then two.');
    const second = sealed(await v.versions.seal(note));
    expect(second.version.file).toBe('2026-10-20T12-00-00Z~2.md');
    const [newest] = await v.versions.list('SAME');
    expect(newest?.file).toBe('2026-10-20T12-00-00Z~2.md');
  });

  it('refuses, changing nothing, when the front matter isn’t a map of keys or holds another tool’s id', async () => {
    for (const text of [
      '---\n- a list\n---\nBody',
      '---\nid: some/path\n---\nBody',
      '---\nkey: [broken\n---\nBody',
    ]) {
      const v = vaultWith({ 'Note.md': text });
      const note = await v.open('Note.md');
      expect((await v.versions.seal(note)).kind, text).toBe('refused');
      expect(await v.read('Note.md')).toBe(text);
      expect(await v.storage.listFiles('.eien/versions')).toEqual([]);
    }
  });

  it('refuses when the note can’t be saved, and keeps no seal of words not on disk', async () => {
    const v = vaultWith({ 'Note.md': '---\nid: FULL\n---\nSaved.' });
    const note = await v.open('Note.md');
    note.type('---\nid: FULL\n---\nSaved. And unsaved.');
    note.state.failSaves = true;
    expect(await v.versions.seal(note)).toMatchObject({ kind: 'refused' });
    expect(await v.sealFiles('FULL')).toEqual([]);
  });

  it('gives a copied note its own id, and both keep the seals made before the copy', async () => {
    const v = vaultWith({ 'Original.md': '---\nid: SHARED\n---\nFirst draft.' });
    const original = await v.open('Original.md');
    const first = sealed(await v.versions.seal(original));
    // Duplicated in Finder: the copy has the same id.
    v.storage.put('Copy.md', '---\nid: SHARED\n---\nFirst draft.');
    v.tick(60_000);
    const copy = await v.open('Copy.md');
    copy.type('---\nid: SHARED\n---\nFirst draft, taken elsewhere.');
    const copied = sealed(await v.versions.seal(copy));
    expect(copied.id).toBe('A000000000');
    expect(await v.read('Copy.md')).toBe('---\nid: A000000000\n---\nFirst draft, taken elsewhere.');
    expect(await v.sealFiles('A000000000')).toEqual([first.version.file, copied.version.file]);
    expect(await v.sealFiles('SHARED')).toEqual([first.version.file]); // the original's own, as it was
  });
});

describe('restoring', () => {
  it('seals the draft first, then puts the seal back, keeping the note’s id', async () => {
    const v = vaultWith({ 'Note.md': '---\nid: R1\n---\nThe old ending.' });
    const note = await v.open('Note.md');
    const old = sealed(await v.versions.seal(note));
    v.tick(1000);
    note.type('---\nid: R1\n---\nA new ending, not as good.');
    const result = await v.versions.restore(note, 'R1', old.version);
    expect(result.kind).toBe('sealed'); // the draft, kept
    expect(await v.read('Note.md')).toBe('---\nid: R1\n---\nThe old ending.');
    const files = await v.sealFiles('R1');
    expect(files).toHaveLength(2);
    const draftSeal = (await v.versions.list('R1'))[0] as VersionFile;
    expect(await v.versions.text('R1', draftSeal)).toBe(
      '---\nid: R1\n---\nA new ending, not as good.',
    );
  });

  it('keeps the note’s own id when the seal came from before it had a new one', async () => {
    const v = vaultWith({ 'Note.md': '---\nid: NEW\n---\nNow.' });
    v.storage.put('.eien/versions/NEW/2026-01-01T00-00-00Z.md', '---\nid: OLD\n---\nThen.');
    const note = await v.open('Note.md');
    const [then] = await v.versions.list('NEW');
    await v.versions.restore(note, 'NEW', then as VersionFile);
    expect(await v.read('Note.md')).toBe('---\nid: NEW\n---\nThen.');
  });

  it('refuses a seal that’s gone before touching anything', async () => {
    const v = vaultWith({ 'Note.md': '---\nid: G\n---\nDraft.' });
    const note = await v.open('Note.md');
    const gone = { file: '2020-01-01T00-00-00Z.md', at: 0, name: null, count: 1 };
    expect(await v.versions.restore(note, 'G', gone)).toMatchObject({ kind: 'refused' });
    expect(await v.read('Note.md')).toBe('---\nid: G\n---\nDraft.');
    expect(await v.sealFiles('G')).toEqual([]);
  });

  it('seals words typed while the draft was being sealed, before they’re replaced', async () => {
    const v = vaultWith({ 'Note.md': '---\nid: T2\n---\nOld.' });
    const note = await v.open('Note.md');
    const old = sealed(await v.versions.seal(note));
    note.type('---\nid: T2\n---\nDraft.');
    v.tick(2000);
    const amend = note.amend;
    let typedOnce = false;
    note.amend = (change, undoable) => {
      if (!typedOnce) {
        typedOnce = true; // the writer types just as the draft is sealed
        note.type('---\nid: T2\n---\nDraft, and more.');
      }
      return amend(change, undoable);
    };
    expect((await v.versions.restore(note, 'T2', old.version)).kind).toBe('sealed');
    const texts = await Promise.all(
      (await v.versions.list('T2')).map((s) => v.versions.text('T2', s)),
    );
    expect(texts).toContain('---\nid: T2\n---\nDraft, and more.');
    expect(await v.read('Note.md')).toBe('---\nid: T2\n---\nOld.');
  });
});

describe('naming and deleting', () => {
  it('names a seal, renames it, and takes the name away', async () => {
    const v = vaultWith({ 'Note.md': '---\nid: N\n---\nText.' });
    const note = await v.open('Note.md');
    const { version } = sealed(await v.versions.seal(note));
    const named = await v.versions.name('N', version, 'before the rewrite');
    expect(named).toMatchObject({ name: 'before the rewrite', at: version.at });
    const renamed = await v.versions.name('N', named as VersionFile, 'after: the rewrite?');
    expect(renamed).toMatchObject({ name: 'after the rewrite' });
    const plain = await v.versions.name('N', renamed as VersionFile, '');
    expect(plain).toMatchObject({ name: null, file: version.file });
    expect(await v.sealFiles('N')).toEqual([version.file]);
  });

  it('says why when the seal is gone', async () => {
    const v = vaultWith({});
    const gone = {
      file: '2020-01-01T00-00-00Z.md',
      at: Date.UTC(2020, 0, 1),
      name: null,
      count: 1,
    };
    expect(await v.versions.name('X', gone, 'name')).toEqual({
      reason: 'That seal isn’t there any more.',
    });
  });

  it('sends a deleted seal to the system’s trash', async () => {
    const v = vaultWith({ 'Note.md': '---\nid: D\n---\nText.' });
    const note = await v.open('Note.md');
    const { version } = sealed(await v.versions.seal(note));
    await v.versions.remove('D', version);
    expect(v.storage.trashed).toEqual([`.eien/versions/D/${version.file}`]);
    expect(await v.sealFiles('D')).toEqual([]);
  });
});

describe('thinning', () => {
  it('thins old unnamed seals to one a day, to the trash, when a new seal is made', async () => {
    const v = vaultWith({ 'Note.md': '---\nid: T\n---\nNow.' });
    for (const [i, name] of ['', '', '--kept'].entries()) {
      // August 1st: more than 30 days before START.
      v.storage.put(`.eien/versions/T/2026-08-01T0${i}-00-00Z${name}.md`, `old ${i}`);
    }
    const note = await v.open('Note.md');
    sealed(await v.versions.seal(note));
    expect(v.storage.trashed).toEqual(['.eien/versions/T/2026-08-01T00-00-00Z.md']);
    expect(await v.sealFiles('T')).toEqual([
      '2026-08-01T01-00-00Z.md',
      '2026-08-01T02-00-00Z--kept.md',
      '2026-10-20T12-00-00Z.md',
    ]);
  });
});
