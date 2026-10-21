// The Storage contract (spec §11): the same tests against every
// implementation, so the disk and the test double can't drift apart.

import {
  chmod,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rename,
  rm,
  symlink,
  utimes,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VaultPathError } from '../core/paths';
import type { Mix } from '../core/themes';
import { CapacitorStorage, TRASH_FOLDER } from './capacitor/capacitor-storage';
import { NodeFiles } from './capacitor/node-files';
import { type DiskStorage, openDiskStorage, writeDurably } from './electron/disk-storage';
import { recoverStrays } from './electron/recover-strays';
import { MemoryStorage } from './memory/memory-storage';
import type { Storage } from './storage';
import { tempBeside } from './stray';
import { ThemeFiles } from './theme-files';

/** The temp file a crash left beside `name`: one write's, with its token. */
const tempNameOf = (name: string) => tempBeside(name, '0a1b2c3d');

interface Subject {
  storage: Storage;
  /** Change a file as another program would. */
  putOutside(path: string, text: string): Promise<void>;
  /** The names in the system's trash. */
  trashed(): Promise<string[]>;
  cleanup(): Promise<void>;
}

const implementations: Record<string, () => Promise<Subject>> = {
  memory: async () => {
    const storage = new MemoryStorage();
    return {
      storage,
      putOutside: async (path, text) => storage.put(path, text),
      trashed: async () => storage.trashed.map((path) => path.slice(path.lastIndexOf('/') + 1)),
      cleanup: async () => {},
    };
  },
  disk: async () => {
    const root = await mkdtemp(join(tmpdir(), 'eien-storage-'));
    // The system's trash, played by a folder beside the vault.
    const trash = await mkdtemp(join(tmpdir(), 'eien-trash-'));
    const storage = await openDiskStorage(root, (path) =>
      rename(path, join(trash, basename(path))),
    );
    return {
      trashed: () => readdir(trash),
      storage,
      putOutside: async (path, text) => {
        const file = join(storage.root, ...path.split('/'));
        await mkdir(join(file, '..'), { recursive: true });
        await writeFile(file, text);
      },
      cleanup: async () => {
        await rm(root, { recursive: true, force: true });
        await rm(trash, { recursive: true, force: true });
      },
    };
  },
};

// The phone's: Capacitor's file system played by Node's on a folder, looked at every 20 ms.
implementations.capacitor = async () => {
  const root = await mkdtemp(join(tmpdir(), 'eien-phone-'));
  return {
    storage: new CapacitorStorage(new NodeFiles(root), { pollMs: 20 }),
    putOutside: async (path, text) => {
      const file = join(root, ...path.split('/'));
      await mkdir(join(file, '..'), { recursive: true });
      await writeFile(file, text);
    },
    // .eien/trash/<moment>/<name>: the names, as a system's trash shows them.
    trashed: async () => {
      const trash = join(root, ...TRASH_FOLDER.split('/'));
      const moments = await readdir(trash).catch(() => [] as string[]);
      return (await Promise.all(moments.map((moment) => readdir(join(trash, moment))))).flat();
    },
    cleanup: () => rm(root, { recursive: true, force: true }),
  };
};

for (const [name, make] of Object.entries(implementations)) {
  describe(`Storage contract: ${name}`, () => {
    let subject: Subject;
    beforeEach(async () => {
      subject = await make();
    });
    afterEach(() => subject.cleanup());

    it('reads a missing file as null', async () => {
      expect(await subject.storage.read('Nothing.md')).toBeNull();
    });

    it('creates a file only where there is none', async () => {
      const created = await subject.storage.write('Note.md', 'One.', null);
      expect(created.ok).toBe(true);
      const again = await subject.storage.write('Note.md', 'Two.', null);
      expect(again).toEqual({ ok: false, current: await subject.storage.read('Note.md') });
      expect((await subject.storage.read('Note.md'))?.text).toBe('One.');
    });

    it('never writes over a temp file another write left: its words may be nowhere else', async () => {
      // A crash's temp file on another device, brought here by Syncthing before that device
      // could recover it. One from before tokens, and one whose token this write draws first.
      const { storage } = subject;
      await subject.putOutside('Note.md', 'Before.');
      await subject.putOutside('.Note.md.eien.tmp', 'The laptop’s paragraph.');
      await subject.putOutside('.Note.md.0a1b2c3d.eien.tmp', 'The tablet’s paragraph.');
      const random = vi.spyOn(crypto, 'getRandomValues').mockImplementationOnce((array) => {
        if (array instanceof Uint32Array) array[0] = 0x0a1b2c3d;
        return array;
      });
      let version = (await storage.read('Note.md'))?.version ?? null;
      for (const words of ['After.', 'After, twice.']) {
        const written = await storage.write('Note.md', words, version);
        if (!written.ok) throw new Error('refused');
        version = written.version;
      }
      expect((await storage.read('Note.md'))?.text).toBe('After, twice.');
      expect((await storage.read('.Note.md.eien.tmp'))?.text).toBe('The laptop’s paragraph.');
      expect((await storage.read('.Note.md.0a1b2c3d.eien.tmp'))?.text).toBe(
        'The tablet’s paragraph.',
      );
      random.mockRestore();
    });

    it('reads a file’s bytes, and nothing for a missing one', async () => {
      await subject.putOutside('art/cover.png', 'PNG-bytes');
      const bytes = await subject.storage.readBytes('art/cover.png');
      expect(bytes && new TextDecoder().decode(bytes)).toBe('PNG-bytes');
      expect(await subject.storage.readBytes('art/none.png')).toBeNull();
      await expect(subject.storage.readBytes('../outside.png')).rejects.toThrow(VaultPathError);
    });

    it('writes a new file’s bytes exactly, making its folders, only where nothing is', async () => {
      const { storage } = subject;
      const bytes = Uint8Array.from({ length: 256 }, (_, i) => i);
      expect(await storage.writeNew('Art/Deep/scarf.png', bytes)).toBe(true);
      expect([...((await storage.readBytes('Art/Deep/scarf.png')) ?? [])]).toEqual([...bytes]);
      expect(await storage.listFiles('Art/Deep')).toEqual(['scarf.png']);
      const listed = (await storage.list()).find((entry) => entry.path === 'Art/Deep/scarf.png');
      expect(listed).toMatchObject({ kind: 'file', size: 256 });
      // Something there: a file, a folder, or one put there a moment ago. Never written over.
      // (A name there in another case too, on a disk that tells case apart: case-twins.test.ts.)
      expect(await storage.writeNew('Art/Deep/scarf.png', new Uint8Array([1]))).toBe(false);
      expect([...((await storage.readBytes('Art/Deep/scarf.png')) ?? [])]).toEqual([...bytes]);
      expect(await storage.writeNew('Art', new Uint8Array([1]))).toBe(false);
      await subject.putOutside('Art/synced.png', 'from another device');
      expect(await storage.writeNew('Art/synced.png', new Uint8Array([1]))).toBe(false);
      expect((await storage.read('Art/synced.png'))?.text).toBe('from another device');
      await expect(storage.writeNew('../outside.png', new Uint8Array([1]))).rejects.toThrow();
      expect(await storage.writeNew('Art/empty.png', new Uint8Array())).toBe(true);
      expect(await storage.readBytes('Art/empty.png')).toEqual(new Uint8Array());
    });

    it('reads back exactly what it wrote, with a version that matches', async () => {
      const result = await subject.storage.write('Note.md', 'Words.', null);
      const read = await subject.storage.read('Note.md');
      expect(read?.text).toBe('Words.');
      expect(result.ok && result.version).toBe(read?.version);
    });

    it('keeps bytes exactly: BOM, CRLF, emoji, CJK, an empty file', async () => {
      for (const [i, text] of ['﻿One.\r\nTwo.\r\n', '永遠 🧣\n', ''].entries()) {
        await subject.storage.write(`n${i}.md`, text, null);
        expect((await subject.storage.read(`n${i}.md`))?.text).toBe(text);
      }
    });

    it('writes over a file only at the version it expects', async () => {
      const first = await subject.storage.write('Note.md', 'One.', null);
      if (!first.ok) throw new Error('create failed');
      const second = await subject.storage.write('Note.md', 'Two.', first.version);
      expect(second.ok).toBe(true);
      if (!second.ok) return;
      expect(second.version).not.toBe(first.version);
      // a writer still holding the first version is refused, and told what's there
      const stale = await subject.storage.write('Note.md', 'Stale.', first.version);
      expect(stale.ok).toBe(false);
      expect(!stale.ok && stale.current?.text).toBe('Two.');
      expect((await subject.storage.read('Note.md'))?.text).toBe('Two.');
    });

    it('refuses to write over a file another program changed', async () => {
      const first = await subject.storage.write('Note.md', 'Mine.', null);
      if (!first.ok) throw new Error('create failed');
      await subject.putOutside('Note.md', 'Theirs.');
      const result = await subject.storage.write('Note.md', 'Mine, edited.', first.version);
      expect(result.ok).toBe(false);
      expect((await subject.storage.read('Note.md'))?.text).toBe('Theirs.');
    });

    it('makes the folders a new file needs', async () => {
      await subject.storage.write('Fic/A Mended Scarf/Seventeen.md', 'Text', null);
      expect((await subject.storage.read('Fic/A Mended Scarf/Seventeen.md'))?.text).toBe('Text');
    });

    it('lists folders, notes and other files, and leaves hidden ones out', async () => {
      await subject.storage.write('Fic/Seventeen.md', 'a', null);
      await subject.storage.write('Fic/cover.png', 'b', null);
      await subject.storage.write('Ideas.md', 'c', null);
      await subject.putOutside('.eien/config.json', '{}');
      await subject.putOutside('Fic/.hidden.md', 'x');
      const listed = (await subject.storage.list()).map((e) => `${e.kind}:${e.path}`).sort();
      expect(listed).toEqual([
        'file:Fic/cover.png',
        'folder:Fic',
        'note:Fic/Seventeen.md',
        'note:Ideas.md',
      ]);
    });

    it.each(['../escape.md', '/etc/passwd', 'Fic/../../escape.md', 'CON.md', 'a\\b.md'])(
      'refuses the path %j',
      async (path) => {
        await expect(subject.storage.read(path)).rejects.toThrow(VaultPathError);
        await expect(subject.storage.write(path, 'x', null)).rejects.toThrow(VaultPathError);
      },
    );

    it('lists the files in one folder, hidden ones such as .eien’s too, but not their temp files', async () => {
      const id = '.eien/versions/01JB2X4Q7Z';
      await subject.storage.write(`${id}/2026-10-19T16-40-02Z.md`, 'one', null);
      await subject.storage.write(`${id}/2026-10-20T08-00-00Z--named.md`, 'two', null);
      await subject.storage.write(`${id}/deeper/inside.md`, 'not this one', null);
      await subject.putOutside(`${id}/.2026-10-19T16-40-02Z.md.eien.tmp`, 'a write cut short');
      expect((await subject.storage.listFiles(id)).sort()).toEqual([
        '2026-10-19T16-40-02Z.md',
        '2026-10-20T08-00-00Z--named.md',
      ]);
      await subject.storage.write('Top.md', 'top', null);
      expect(await subject.storage.listFiles('')).toEqual(['Top.md']);
    });

    it('lists nothing in a folder that isn’t there, or for a file, and refuses one outside the vault', async () => {
      expect(await subject.storage.listFiles('.eien/versions/NONE')).toEqual([]);
      await subject.storage.write('Note.md', 'x', null);
      expect(await subject.storage.listFiles('Note.md')).toEqual([]);
      await expect(subject.storage.listFiles('../outside')).rejects.toThrow();
    });

    it('moves a note to a new name, words and all, and the old name is gone', async () => {
      await subject.putOutside('Old.md', 'Words.');
      expect(await subject.storage.move('Old.md', 'New.md')).toEqual({ ok: true });
      expect((await subject.storage.read('New.md'))?.text).toBe('Words.');
      expect(await subject.storage.read('Old.md')).toBeNull();
      expect((await subject.storage.list()).map((entry) => entry.path)).toEqual(['New.md']);
    });

    it('renames a note by case alone: the same file', async () => {
      await subject.putOutside('note.md', 'Words.');
      expect(await subject.storage.move('note.md', 'Note.md')).toEqual({ ok: true });
      expect((await subject.storage.list()).map((entry) => entry.path)).toEqual(['Note.md']);
      expect((await subject.storage.read('Note.md'))?.text).toBe('Words.');
    });

    it('moves a note into a folder that isn’t there yet', async () => {
      await subject.putOutside('Loose.md', 'x');
      expect(await subject.storage.move('Loose.md', 'Fic/Deep/Loose.md')).toEqual({ ok: true });
      expect(
        (await subject.storage.list()).map((entry) => `${entry.kind}:${entry.path}`).sort(),
      ).toEqual(['folder:Fic', 'folder:Fic/Deep', 'note:Fic/Deep/Loose.md']);
    });

    it('moves a folder with everything in it, its hidden settings too', async () => {
      await subject.putOutside('Fic/A.md', 'a');
      await subject.putOutside('Fic/Inner/B.md', 'b');
      await subject.putOutside('Fic/.eien-folder.json', '{"book":{}}');
      expect(await subject.storage.move('Fic', 'Fiction')).toEqual({ ok: true });
      expect((await subject.storage.list()).map((entry) => entry.path).sort()).toEqual([
        'Fiction',
        'Fiction/A.md',
        'Fiction/Inner',
        'Fiction/Inner/B.md',
      ]);
      expect((await subject.storage.read('Fiction/.eien-folder.json'))?.text).toBe('{"book":{}}');
    });

    it('refuses a move from nothing, onto something else, or into itself, and changes nothing', async () => {
      await subject.putOutside('A.md', 'a');
      await subject.putOutside('B.md', 'b');
      await subject.putOutside('Fic/C.md', 'c');
      expect(await subject.storage.move('Nothing.md', 'X.md')).toEqual({
        ok: false,
        reason: 'missing',
      });
      expect(await subject.storage.move('A.md', 'B.md')).toEqual({ ok: false, reason: 'taken' });
      expect(await subject.storage.move('A.md', 'Fic')).toEqual({ ok: false, reason: 'taken' });
      expect(await subject.storage.move('Fic', 'Fic/Inside')).toEqual({
        ok: false,
        reason: 'into-itself',
      });
      expect((await subject.storage.read('A.md'))?.text).toBe('a');
      expect((await subject.storage.read('B.md'))?.text).toBe('b');
      expect((await subject.storage.read('Fic/C.md'))?.text).toBe('c');
    });

    it('never loses what it couldn’t move', async () => {
      await subject.putOutside('A.md', 'a');
      await subject.putOutside('File.md', 'f');
      await expect(subject.storage.move('A.md', 'File.md/A.md')).rejects.toThrow();
      expect((await subject.storage.read('A.md'))?.text).toBe('a');
    });

    it('sends a note or a whole folder to the trash, and refuses nothing', async () => {
      await subject.putOutside('Gone.md', 'x');
      await subject.putOutside('Old/One.md', '1');
      await subject.storage.trash('Gone.md');
      await subject.storage.trash('Old');
      expect(await subject.storage.list()).toEqual([]);
      expect((await subject.trashed()).sort()).toEqual(['Gone.md', 'Old']);
      await expect(subject.storage.trash('Never.md')).rejects.toThrow();
    });

    describe('the writer’s themes, one file each in .eien/themes', () => {
      const LATE: Mix = { paper: 215, warmth: 10, ink: 225, seal: 8 };
      const themes = () => new ThemeFiles(subject.storage);
      const titles = async () => (await themes().list()).map((theme) => theme.title);

      it('makes one, lists it, and saves its mix, keeping the keys it doesn’t know', async () => {
        const made = await themes().create('Late Train', LATE);
        expect(made).toEqual({
          title: 'Late Train',
          path: '.eien/themes/Late Train.json',
          mix: LATE,
          problems: [],
        });
        const path = '.eien/themes/Late Train.json';
        const file = JSON.parse((await subject.storage.read(path))?.text ?? '');
        expect(file).toEqual({ name: 'Late Train', mix: LATE });
        await subject.putOutside(path, JSON.stringify({ ...file, made: 'on the phone' }));
        await themes().write('Late Train', { ...LATE, warmth: 30 });
        expect(JSON.parse((await subject.storage.read(path))?.text ?? '')).toEqual({
          name: 'Late Train',
          made: 'on the phone',
          mix: { ...LATE, warmth: 30 },
        });
        expect(await themes().list()).toEqual([
          { title: 'Late Train', path, mix: { ...LATE, warmth: 30 }, problems: [] },
        ]);
      });

      it('lists what another device put there, by name, and leaves out what isn’t a theme', async () => {
        await subject.putOutside('.eien/themes/Orchard.json', JSON.stringify({ mix: LATE }));
        await subject.putOutside('.eien/themes/broken.json', '{ "mix": ');
        await subject.putOutside('.eien/themes/notes.md', 'not a theme');
        await subject.putOutside('.eien/themes/.Orchard.json.0a1b2c3d.eien.tmp', '{}');
        const listed = await themes().list();
        expect(listed.map((theme) => [theme.title, theme.mix])).toEqual([
          ['broken', null],
          ['Orchard', LATE],
        ]);
        expect(await themes().list()).toEqual(listed); // and changes nothing
        expect(await new ThemeFiles(subject.storage).read('Nothing')).toBeNull();
      });

      it('lists none, and makes the folder for the first', async () => {
        expect(await themes().list()).toEqual([]);
        await themes().create('First', LATE);
        expect(await titles()).toEqual(['First']);
      });

      it('numbers a new theme whose name another has, in any case', async () => {
        await themes().create('Untitled', LATE);
        const second = await themes().create('untitled', LATE);
        expect(second).toMatchObject({ title: 'untitled 2' });
        expect(await themes().create('  ', LATE)).toEqual({ ok: false, problem: 'empty' });
        expect(await titles()).toEqual(['Untitled', 'untitled 2']);
      });

      it('renames the file and the name inside; a change of case is the same theme', async () => {
        await themes().create('late train', LATE);
        expect(await themes().rename('late train', 'Late Train')).toEqual({
          ok: true,
          title: 'Late Train',
        });
        expect(await titles()).toEqual(['Late Train']);
        expect(await themes().rename('Late Train', 'Night: Train?')).toEqual({
          ok: true,
          title: 'Night Train',
        });
        expect(await titles()).toEqual(['Night Train']);
        const file = JSON.parse(
          (await subject.storage.read('.eien/themes/Night Train.json'))?.text ?? '',
        );
        expect(file).toEqual({ name: 'Night Train', mix: LATE });
      });

      it('refuses a name another theme has, in any case, and an empty one, changing nothing', async () => {
        await themes().create('Orchard', LATE);
        await themes().create('Late Train', LATE);
        expect(await themes().rename('Late Train', 'ORCHARD')).toEqual({
          ok: false,
          problem: 'taken',
        });
        expect(await themes().rename('Late Train', '...')).toEqual({ ok: false, problem: 'empty' });
        expect(await titles()).toEqual(['Late Train', 'Orchard']);
        await expect(themes().rename('Gone', 'Elsewhere')).rejects.toThrow('isn’t there any more');
      });

      it('sends one to the trash, where the writer can take it back', async () => {
        await themes().create('Late Train', LATE);
        await themes().trash('Late Train');
        expect(await titles()).toEqual([]);
        expect(await subject.trashed()).toEqual(['Late Train.json']);
        await expect(themes().trash('Late Train')).rejects.toThrow();
      });

      it('never writes over a file it can’t read, nor brings back one that’s gone', async () => {
        await subject.putOutside('.eien/themes/Half.json', '{ "mix": ');
        await expect(themes().write('Half', LATE)).rejects.toThrow('isn’t valid JSON');
        expect((await subject.storage.read('.eien/themes/Half.json'))?.text).toBe('{ "mix": ');
        await expect(themes().write('Gone', LATE)).rejects.toThrow('isn’t there any more');
        expect(await subject.storage.read('.eien/themes/Gone.json')).toBeNull();
      });
    });

    it('makes folders, any depth; one already there is fine; a file there is not', async () => {
      await subject.storage.makeFolder('A/B/C');
      await subject.storage.makeFolder('A/B');
      expect(
        (await subject.storage.list()).map((entry) => `${entry.kind}:${entry.path}`).sort(),
      ).toEqual(['folder:A', 'folder:A/B', 'folder:A/B/C']);
      await subject.putOutside('Note.md', 'x');
      await expect(subject.storage.makeFolder('Note.md')).rejects.toThrow();
    });

    /**
     * Watch, and wait until the watcher is really listening: a system's
     * watcher can miss what happens in its first moments (macOS's does), so a
     * marker is written until it's heard. The app starts watching when a
     * vault opens, long before anything is written.
     */
    async function listening(seen: string[]): Promise<() => void> {
      const stop = subject.storage.watch((paths) => seen.push(...paths));
      for (let attempt = 0; !seen.includes('Ready.md'); attempt++) {
        if (attempt === 50) throw new Error('the watcher never heard anything');
        await subject.putOutside('Ready.md', String(attempt));
        await new Promise((settle) => setTimeout(settle, 100));
      }
      seen.length = 0;
      return stop;
    }

    it('says when it’s listening, and tells what changes from then on', async () => {
      const seen: string[] = [];
      let stop: () => void = () => undefined;
      await new Promise<void>((ready) => {
        stop = subject.storage.watch((paths) => seen.push(...paths), ready);
      });
      try {
        await subject.putOutside('After.md', 'changed');
        await expect.poll(() => seen, { timeout: 3000 }).toContain('After.md');
      } finally {
        stop();
      }
    });

    it('tells a watcher what changed', async () => {
      const seen: string[] = [];
      const stop = await listening(seen);
      try {
        await subject.putOutside('Watched.md', 'changed');
        await expect.poll(() => seen, { timeout: 3000 }).toContain('Watched.md');
      } finally {
        stop();
      }
    });

    it('keeps telling a watcher while a file changes without pause', async () => {
      const seen: string[] = [];
      const stop = await listening(seen);
      let writing = true;
      const busy = (async () => {
        for (let n = 0; writing; n++) {
          await subject.putOutside('Busy.md', String(n));
          await new Promise((settle) => setTimeout(settle, 30));
        }
      })();
      try {
        await new Promise((settle) => setTimeout(settle, 200));
        await subject.putOutside('Other.md', 'changed meanwhile');
        await expect.poll(() => seen, { timeout: 3000 }).toContain('Other.md');
      } finally {
        writing = false;
        await busy;
        stop();
      }
    });

    it('reads a note under the name it was listed by, accents composed or not', async () => {
      // As a Mac app (or a sync from one) may write it; Linux and Android keep the bytes.
      await subject.putOutside('Cafe\u0301.md', 'decomposed');
      const listed = (await subject.storage.list()).map((entry) => entry.path);
      expect(listed).toHaveLength(1);
      const name = listed[0] ?? '';
      expect(name.normalize('NFC')).toBe('Café.md');
      expect((await subject.storage.read(name))?.text).toBe('decomposed');
      const read = await subject.storage.read(name);
      const written = await subject.storage.write(name, 'changed', read?.version ?? null);
      expect(written.ok).toBe(true);
      expect((await subject.storage.list()).map((entry) => entry.path)).toEqual([name]); // no twin
    });

    it('tells a watcher about the vault’s settings, a note’s seals and the writer’s themes, and no other hidden file', async () => {
      const seen: string[] = [];
      const stop = await listening(seen);
      try {
        const seal = '.eien/versions/01JB2X4Q7Z/2026-10-19T16-40-02Z.md';
        const theme = '.eien/themes/Late Train.json';
        await subject.putOutside('.eien/other.json', '{}');
        await subject.putOutside('Fic/.hidden.md', 'x');
        await subject.putOutside('.eien/config.json', '{}');
        await subject.putOutside(seal, 'sealed on another device');
        await subject.putOutside(theme, '{"mix":{}}');
        await subject.putOutside('.eien/themes/.Late Train.json.0a1b2c3d.eien.tmp', '{}');
        await subject.putOutside('Seen.md', 'x');
        await expect
          .poll(() => seen, { timeout: 3000 })
          .toEqual(expect.arrayContaining(['.eien/config.json', seal, theme, 'Seen.md']));
        const hidden = seen.filter((path) => path.split('/').some((name) => name.startsWith('.')));
        expect(new Set(hidden)).toEqual(new Set(['.eien/config.json', seal, theme]));
      } finally {
        stop();
      }
    });
  });
}

describe('disk only', () => {
  let root: string;
  let storage: DiskStorage;
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'eien-disk-'));
    storage = await openDiskStorage(root);
  });
  afterEach(() => rm(root, { recursive: true, force: true }));

  it('leaves a note where it is when the system’s trash fails', async () => {
    const failing = await openDiskStorage(root, async () => {
      throw new Error('the trash is full');
    });
    await writeFile(join(root, 'Kept.md'), 'words');
    await expect(failing.trash('Kept.md')).rejects.toThrow('the trash is full');
    expect(await readFile(join(root, 'Kept.md'), 'utf8')).toBe('words');
  });

  it('has no trash unless it was given one', async () => {
    await writeFile(join(root, 'Kept.md'), 'words');
    await expect(storage.trash('Kept.md')).rejects.toThrow(/no trash/);
    expect(await readFile(join(root, 'Kept.md'), 'utf8')).toBe('words');
  });

  it('leaves a file as it is when it changed just before the new text took its place', async () => {
    const file = join(storage.root, 'Note.md');
    await writeFile(file, 'theirs');
    const written = await writeDurably(file, 'mine', async () => false);
    expect(written).toBe(false);
    expect(await readFile(file, 'utf8')).toBe('theirs');
    expect(await readdir(storage.root)).toEqual(['Note.md']); // and no temp file
  });

  it('leaves no temp file behind after a write', async () => {
    await storage.write('Note.md', 'Words.', null);
    expect(await readdir(storage.root)).toEqual(['Note.md']);
  });

  it('refuses a path through a symbolic link that leads out of the vault', async () => {
    const outside = await mkdtemp(join(tmpdir(), 'eien-outside-'));
    try {
      await writeFile(join(outside, 'secret.md'), 'secret');
      await symlink(outside, join(storage.root, 'link'), 'dir');
      await expect(storage.read('link/secret.md')).rejects.toThrow(VaultPathError);
      await expect(storage.write('link/new.md', 'x', null)).rejects.toThrow(VaultPathError);
      expect((await storage.list()).map((e) => e.path)).toEqual([]); // the link isn't listed either
    } finally {
      await rm(outside, { recursive: true, force: true });
    }
  });

  describe('after a crash', () => {
    const at = new Date(2026, 9, 19, 16, 40);

    it('removes what a new file’s write left (an import’s image, still where it came from)', async () => {
      await mkdir(join(storage.root, 'Art'));
      await writeFile(join(storage.root, 'Art', '.scarf.png.eien-new'), new Uint8Array([137, 80]));
      expect(await recoverStrays(storage, at)).toEqual([]);
      expect(await readdir(join(storage.root, 'Art'))).toEqual([]);
    });

    it('keeps a temp file newer than its note, with different words, as a recovered note', async () => {
      await storage.write('Seventeen.md', 'Old words.', null);
      const temp = join(storage.root, tempNameOf('Seventeen.md'));
      await writeFile(temp, 'Newer words, not yet renamed.');
      await utimes(join(storage.root, 'Seventeen.md'), new Date(2026, 0, 1), new Date(2026, 0, 1));
      expect(await recoverStrays(storage, at)).toEqual([
        'Seventeen (recovered 2026-10-19 16-40).md',
      ]);
      expect(
        await readFile(join(storage.root, 'Seventeen (recovered 2026-10-19 16-40).md'), 'utf8'),
      ).toBe('Newer words, not yet renamed.');
      expect((await storage.read('Seventeen.md'))?.text).toBe('Old words.');
      expect((await readdir(storage.root)).some((n) => n.endsWith('.eien.tmp'))).toBe(false);
    });

    it('keeps a temp file whose note is gone', async () => {
      await mkdir(join(storage.root, 'Fic'));
      await writeFile(join(storage.root, 'Fic', tempNameOf('Lost.md')), 'Only copy.');
      expect(await recoverStrays(storage, at)).toEqual([
        'Fic/Lost (recovered 2026-10-19 16-40).md',
      ]);
    });

    it('drops a temp file holding its note’s own words, or none', async () => {
      await storage.write('Same.md', 'Same.', null);
      await writeFile(join(storage.root, tempNameOf('Same.md')), 'Same.');
      await writeFile(join(storage.root, tempNameOf('Empty.md')), '');
      expect(await recoverStrays(storage, at)).toEqual([]);
      expect((await readdir(storage.root)).sort()).toEqual(['Same.md']);
    });

    it('keeps a temp file older than its note when its words are other', async () => {
      // The note was changed since by another device: this one's next save would have taken
      // the same temp file, so the temp's words are nowhere else.
      await storage.write('Old.md', 'Current.', null);
      const temp = join(storage.root, tempNameOf('Old.md'));
      await writeFile(temp, 'Older draft.');
      await utimes(temp, new Date(2026, 0, 1), new Date(2026, 0, 1));
      expect(await recoverStrays(storage, at)).toEqual(['Old (recovered 2026-10-19 16-40).md']);
    });

    it.skipIf(process.platform === 'win32')(
      'leaves a temp file it can’t read now, for the next time',
      async () => {
        // Its words unread: removing it would lose them unseen.
        const temp = join(storage.root, tempNameOf('Draft.md'));
        await writeFile(temp, 'Words with nowhere else.');
        await chmod(temp, 0o000);
        try {
          expect(await recoverStrays(storage, at)).toEqual([]);
          expect(await readdir(storage.root)).toEqual([tempNameOf('Draft.md')]);
        } finally {
          await chmod(temp, 0o600);
        }
      },
    );

    it('leaves hidden folders alone', async () => {
      await mkdir(join(storage.root, '.git'));
      await writeFile(join(storage.root, '.git', tempNameOf('x.md')), 'not ours');
      expect(await recoverStrays(storage, at)).toEqual([]);
      expect(await readdir(join(storage.root, '.git'))).toEqual([tempNameOf('x.md')]);
    });

    describe('a phone’s rename cut between its steps, brought here by Syncthing', () => {
      const STAMP = '(recovered 2026-10-19 16-40)';
      const put = async (path: string, words: string) => {
        const file = join(storage.root, ...path.split('/'));
        await mkdir(join(file, '..'), { recursive: true });
        await writeFile(file, words);
      };
      const words = (path: string) => readFile(join(storage.root, ...path.split('/')), 'utf8');

      it('puts a note back under its name, and the vault shows it', async () => {
        // Hidden under its step's name, the note is missing from this device until it's back.
        await put('Fic/.tear.md.eien-case', 'The scarf tore.');
        expect(await recoverStrays(storage, at)).toEqual(['Fic/tear.md']);
        expect(await words('Fic/tear.md')).toBe('The scarf tore.');
        expect((await storage.list()).map((entry) => entry.path)).toEqual(['Fic', 'Fic/tear.md']);
      });

      it('puts a book back, and recovers what’s inside it', async () => {
        await put('.fic.eien-case/One.md', 'Chapter one.');
        await put('.fic.eien-case/.Two.md.eien.tmp', 'Chapter two, never renamed.');
        expect(await recoverStrays(storage, at)).toEqual(['fic', `fic/Two ${STAMP}.md`]);
        expect((await readdir(join(storage.root, 'fic'))).sort()).toEqual([
          'One.md',
          `Two ${STAMP}.md`,
        ]);
      });

      it('the phone finished meanwhile: both are kept, nothing written over', async () => {
        // In flight, not crashed: Syncthing brought the step, then the finished name, before
        // the step's removal. Put back beside it (by any case this system ignores), a duplicate
        // to tidy is the worst there is: never a note written over.
        await put('.tear.md.eien-case', 'The scarf tore.');
        await put('Tear.md', 'The scarf tore. And the phone kept writing.');
        const recovered = await recoverStrays(storage, at);
        expect(recovered).toHaveLength(1);
        expect(await words('Tear.md')).toBe('The scarf tore. And the phone kept writing.');
        expect(await words(recovered[0] as string)).toBe('The scarf tore.');
      });

      it('leaves names that only look like a step', async () => {
        await put('x.eien-case', 'visible, not a step');
        await put('.eien-case', 'only the suffix');
        expect(await recoverStrays(storage, at)).toEqual([]);
        expect((await readdir(storage.root)).sort()).toEqual(['.eien-case', 'x.eien-case']);
      });
    });
  });
});
