// Adversarial: seals (spec §9) over a vault in memory, where the open note is
// played by a target that keeps its text and saves it as the page and session
// would, and the vault can be slowed, broken or raced by another device.

import { describe, expect, it } from 'vitest';
import { isHiddenName } from '../../core/paths';
import { noteIdOf, type VersionFile, versionFileName } from '../../core/versions';
import { MemoryStorage } from '../../platform/memory/memory-storage';
import type { WriteResult } from '../../platform/storage';
import { NoteVersions, type SealResult, type SealTarget } from './note-versions';

const START = Date.UTC(2026, 9, 20, 12, 0, 0);
const DAY = 24 * 60 * 60 * 1000;

interface Hooks {
  /** Runs before each write reaches the vault. */
  beforeWrite?(path: string): Promise<void> | void;
  /** Runs before each read; may throw, as an unreadable file does. */
  beforeRead?(path: string): Promise<void> | void;
  /** Runs before each trash; may throw, as a full trash does. */
  beforeTrash?(path: string): Promise<void> | void;
}

function vaultWith(files: Record<string, string>, hooks: Hooks = {}) {
  const storage = new MemoryStorage();
  for (const [path, text] of Object.entries(files)) storage.put(path, text);
  let clock = START;
  let ids = 0;
  const texts = new Map<string, string>();
  let listed: string[] = [];
  const versions = new NoteVersions({
    vault: {
      listFiles: (folder) => storage.listFiles(folder),
      read: async (path) => {
        await hooks.beforeRead?.(path);
        return storage.read(path);
      },
      write: async (path, text, expected): Promise<WriteResult> => {
        await hooks.beforeWrite?.(path);
        return storage.write(path, text, expected);
      },
      move: (from, to) => storage.move(from, to),
      trash: async (path) => {
        await hooks.beforeTrash?.(path);
        return storage.trash(path);
      },
    },
    notesWithId: (id) => listed.filter((path) => noteIdOf(texts.get(path) ?? '') === id),
    // Ten bytes, a new pattern each time: ids "A000000000", "B111111111"…
    random: () => new Uint8Array(10).fill(ids++),
    now: () => clock,
    dayOf: (at) => new Date(at).toISOString().slice(0, 10),
  });
  const reindex = async () => {
    listed = [];
    for (const entry of await storage.list()) {
      if (entry.kind !== 'note' || entry.path.split('/').some(isHiddenName)) continue;
      listed.push(entry.path);
      texts.set(entry.path, (await storage.read(entry.path))?.text ?? '');
    }
  };
  const open = async (path: string) => {
    await reindex();
    let text = (await storage.read(path))?.text ?? '';
    let saved = text;
    // One save at a time, as the note's session saves (its queue).
    let saving = Promise.resolve(true);
    const saveNow = async () => {
      if (text === saved) return true;
      const current = await storage.read(path);
      const written = await storage.write(path, text, current?.version ?? null);
      if (written.ok) saved = text;
      await reindex();
      return written.ok;
    };
    const target: SealTarget & { type(next: string): void } = {
      path,
      open: () => true,
      text: () => text,
      type: (next) => {
        text = next;
      },
      amend: async (change) => {
        const next = change(text);
        if (next === null) return false;
        text = next;
        return target.save();
      },
      save: () => {
        saving = saving.then(saveNow, saveNow);
        return saving;
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

const sealed = (result: SealResult) => {
  if (result.kind !== 'sealed') throw new Error(`not sealed: ${JSON.stringify(result)}`);
  return result;
};

/** A seal file's name for `at`. */
const fileAt = (at: number, name: string | null = null) => versionFileName(at, name);

describe('words typed while a seal is under way', () => {
  it('⌘S on a copied note: words typed while its seals are copied are kept', async () => {
    // Duplicated in Finder, then sealed and typed on: the words typed meanwhile vanish.
    const files: Record<string, string> = {
      'Original.md': '---\nid: SHARED\n---\nFirst draft.',
      'Copy.md': '---\nid: SHARED\n---\nFirst draft.',
    };
    for (let i = 0; i < 5; i++)
      files[`.eien/versions/SHARED/${fileAt(START - (i + 1) * 1000)}`] = `old ${i}`;
    let typedYet = false;
    let copy: Awaited<ReturnType<ReturnType<typeof vaultWith>['open']>> | null = null;
    const v = vaultWith(files, {
      beforeWrite: (path) => {
        // The first seal copied: the writer is still typing.
        if (!typedYet && path.startsWith('.eien/versions/A000000000/')) {
          typedYet = true;
          copy?.type('---\nid: SHARED\n---\nFirst draft. Typed while sealing.');
        }
      },
    });
    copy = await v.open('Copy.md');
    sealed(await v.versions.seal(copy));
    expect(typedYet).toBe(true);
    expect(copy.text()).toContain('Typed while sealing.');
  });

  it('Restore: words typed while old seals are thinned are kept, in the note or a seal', async () => {
    // Restore seals the draft, thins (a slow trash), then puts the seal back over what was typed meanwhile.
    const old = START - 60 * DAY;
    const files: Record<string, string> = {
      'Note.md': '---\nid: R\n---\nThe draft.',
      [`.eien/versions/R/${fileAt(START - DAY, 'keep')}`]: '---\nid: R\n---\nThe old ending.',
    };
    for (let i = 0; i < 3; i++) files[`.eien/versions/R/${fileAt(old + i * 1000)}`] = `old ${i}`;
    let note: Awaited<ReturnType<ReturnType<typeof vaultWith>['open']>> | null = null;
    let typed = false;
    const v = vaultWith(files, {
      beforeTrash: () => {
        if (typed) return;
        typed = true;
        note?.type('---\nid: R\n---\nThe draft. Typed while restoring.');
      },
    });
    note = await v.open('Note.md');
    const [keep] = (await v.versions.list('R')).filter((s) => s.name === 'keep');
    await v.versions.restore(note, 'R', keep as VersionFile);
    expect(typed).toBe(true);
    const everywhere = [
      note.text(),
      ...(await Promise.all((await v.sealFiles('R')).map((f) => v.read(`.eien/versions/R/${f}`)))),
    ];
    expect(everywhere.some((text) => text?.includes('Typed while restoring.'))).toBe(true);
  });
});

describe('a seal from a clock that was wrong', () => {
  it('a seal dated in the future (another device’s clock) doesn’t make every ⌘S a new seal', async () => {
    // "Nothing is made if the note matches its last checkpoint": the last is the one just made here.
    const future = Date.UTC(2099, 0, 1);
    const v = vaultWith({
      'Note.md': '---\nid: F\n---\nWords.',
      [`.eien/versions/F/${fileAt(future)}`]: '---\nid: F\n---\nThe phone’s words.',
    });
    const note = await v.open('Note.md');
    sealed(await v.versions.seal(note));
    v.tick(5000);
    expect((await v.versions.seal(note)).kind).toBe('same');
    expect(await v.sealFiles('F')).toHaveLength(2);
  });
});

describe('a seal that can’t be written or read', () => {
  it('the seals folder is a file: ⌘S is refused with a reason, not thrown', async () => {
    // The window has no catch around ⌘S: a throw here is a silent ⌘S.
    const v = vaultWith({
      'Note.md': '---\nid: BLOCKED\n---\nWords.',
      '.eien/versions/BLOCKED': 'another tool’s file',
    });
    const note = await v.open('Note.md');
    const result = await v.versions
      .seal(note)
      .catch((error: unknown) => ({ thrown: String(error) }));
    expect(result).toMatchObject({ kind: 'refused' });
  });

  it('the latest seal can’t be read (locked, still downloading): ⌘S still seals', async () => {
    const v = vaultWith(
      {
        'Note.md': '---\nid: LOCKED\n---\nNew words.',
        [`.eien/versions/LOCKED/${fileAt(START - DAY)}`]: '---\nid: LOCKED\n---\nOld words.',
      },
      {
        beforeRead: (path) => {
          if (path.endsWith(fileAt(START - DAY))) throw new Error('EACCES: permission denied');
        },
      },
    );
    const note = await v.open('Note.md');
    const result = await v.versions
      .seal(note)
      .catch((error: unknown) => ({ thrown: String(error) }));
    expect(result).toMatchObject({ kind: 'sealed' });
  });

  it('a note whose front matter has an empty `id:` (a template’s) can be sealed', async () => {
    // "id:" with nothing after it is no id at all; refusing it means the note can never be sealed.
    for (const empty of ['id:', 'id: ', 'id: null', 'id: ~']) {
      const text = `---\ntitle: Chapter\n${empty}\n---\nWords.`;
      const v = vaultWith({ 'Note.md': text });
      const note = await v.open('Note.md');
      const result = await v.versions.seal(note);
      expect(result.kind, empty).toBe('sealed');
      expect(note.text()).toMatch(/^---\ntitle: Chapter\nid: A000000000\n---\nWords\.$/);
    }
  });
});

describe('hardening', () => {
  it('three copies sealed in turn each get their own id, and every one keeps the seals before', async () => {
    const text = '---\nid: TRIPLE\n---\nWords.';
    const v = vaultWith({
      'A.md': text,
      'Fic/B.md': text,
      'Fic/Deep/C.md': text,
      [`.eien/versions/TRIPLE/${fileAt(START - DAY)}`]: text,
    });
    const ids = new Set<string>();
    for (const path of ['Fic/B.md', 'Fic/Deep/C.md', 'A.md']) {
      const note = await v.open(path);
      note.type(`${note.text()} In ${path}.`);
      const result = sealed(await v.versions.seal(note));
      ids.add(result.id);
      expect(await v.sealFiles(result.id), path).toHaveLength(2);
    }
    expect(ids.size).toBe(3);
    expect(ids.has('TRIPLE')).toBe(true); // the last one left with it keeps it
  });

  it('another device took the seal’s file name in the same second: counted, never written over', async () => {
    let raced = false;
    const v = vaultWith(
      { 'Note.md': '---\nid: RACE\n---\nMine.' },
      {
        beforeWrite: (path) => {
          if (raced || !path.startsWith('.eien/versions/')) return;
          raced = true;
          v.storage.put(path, '---\nid: RACE\n---\nThe phone’s.');
        },
      },
    );
    const note = await v.open('Note.md');
    const result = sealed(await v.versions.seal(note));
    expect(result.version.file).toBe('2026-10-20T12-00-00Z~2.md');
    expect(await v.read('.eien/versions/RACE/2026-10-20T12-00-00Z.md')).toContain('The phone’s.');
    expect(await v.read('.eien/versions/RACE/2026-10-20T12-00-00Z~2.md')).toContain('Mine.');
  });

  it('⌘S twice at once makes one seal', async () => {
    const v = vaultWith({ 'Note.md': 'No id yet.' });
    const note = await v.open('Note.md');
    const [a, b] = await Promise.all([v.versions.seal(note), v.versions.seal(note)]);
    const id = noteIdOf(note.text()) as string;
    expect([a.kind, b.kind].sort()).toEqual(['same', 'sealed']);
    expect(await v.sealFiles(id)).toHaveLength(1);
  });

  it('a thinning the trash refuses keeps every seal, and the new seal is still made', async () => {
    const old = START - 60 * DAY;
    const v = vaultWith(
      {
        'Note.md': '---\nid: KEEP\n---\nNow.',
        [`.eien/versions/KEEP/${fileAt(old)}`]: 'a',
        [`.eien/versions/KEEP/${fileAt(old + 1000)}`]: 'b',
      },
      {
        beforeTrash: () => {
          throw new Error('The trash is full.');
        },
      },
    );
    const note = await v.open('Note.md');
    sealed(await v.versions.seal(note));
    expect(await v.sealFiles('KEEP')).toHaveLength(3);
  });

  it('restoring a seal with no front matter, or another note’s id, keeps the note’s own id', async () => {
    for (const sealText of [
      'Plain words, no front matter.',
      '---\nid: SOMEONE\ntags: [x]\n---\nTheirs.',
    ]) {
      const v = vaultWith({
        'Note.md': '---\nid: MINE\n---\nDraft.',
        [`.eien/versions/MINE/${fileAt(START - DAY)}`]: sealText,
      });
      const note = await v.open('Note.md');
      const [old] = await v.versions.list('MINE');
      await v.versions.restore(note, 'MINE', old as VersionFile);
      expect(noteIdOf(note.text()), sealText).toBe('MINE');
      expect(note.text()).toContain(sealText.replace(/^---\n(?:[^\n]*\n)*?---\n/, ''));
    }
  });

  it('a copy and its original, in two folders, sealed in the same second: both histories whole', async () => {
    const text = '---\nid: TWIN\n---\nWords.';
    const v = vaultWith({
      'One/Twin.md': text,
      'Two/Twin.md': text,
      [`.eien/versions/TWIN/${fileAt(START - DAY)}`]: text,
    });
    const one = await v.open('One/Twin.md');
    const two = await v.open('Two/Twin.md');
    one.type(`${text} One.`);
    two.type(`${text} Two.`);
    const [a, b] = await Promise.all([v.versions.seal(one), v.versions.seal(two)]);
    const first = sealed(a);
    const second = sealed(b);
    expect(first.id).not.toBe(second.id);
    for (const result of [first, second]) {
      expect(await v.sealFiles(result.id)).toHaveLength(2);
    }
  });
});
