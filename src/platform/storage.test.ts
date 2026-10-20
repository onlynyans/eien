// The Storage contract (spec §11): the same tests against every
// implementation, so the disk and the test double can't drift apart.

import {
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
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { VaultPathError } from '../core/paths';
import {
  type DiskStorage,
  openDiskStorage,
  tempNameOf,
  writeDurably,
} from './electron/disk-storage';
import { recoverStrayTemps } from './electron/recover-temps';
import { MemoryStorage } from './memory/memory-storage';
import type { Storage } from './storage';

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

    it('reads a file’s bytes, and nothing for a missing one', async () => {
      await subject.putOutside('art/cover.png', 'PNG-bytes');
      const bytes = await subject.storage.readBytes('art/cover.png');
      expect(bytes && new TextDecoder().decode(bytes)).toBe('PNG-bytes');
      expect(await subject.storage.readBytes('art/none.png')).toBeNull();
      await expect(subject.storage.readBytes('../outside.png')).rejects.toThrow(VaultPathError);
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

    it('tells a watcher about the vault’s settings and a note’s seals, and no other hidden file', async () => {
      const seen: string[] = [];
      const stop = await listening(seen);
      try {
        const seal = '.eien/versions/01JB2X4Q7Z/2026-10-19T16-40-02Z.md';
        await subject.putOutside('.eien/other.json', '{}');
        await subject.putOutside('Fic/.hidden.md', 'x');
        await subject.putOutside('.eien/config.json', '{}');
        await subject.putOutside(seal, 'sealed on another device');
        await subject.putOutside('Seen.md', 'x');
        await expect
          .poll(() => seen, { timeout: 3000 })
          .toEqual(expect.arrayContaining(['.eien/config.json', seal, 'Seen.md']));
        const hidden = seen.filter((path) => path.split('/').some((name) => name.startsWith('.')));
        expect(new Set(hidden)).toEqual(new Set(['.eien/config.json', seal]));
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

    it('keeps a temp file newer than its note, with different words, as a recovered note', async () => {
      await storage.write('Seventeen.md', 'Old words.', null);
      const temp = join(storage.root, tempNameOf('Seventeen.md'));
      await writeFile(temp, 'Newer words, not yet renamed.');
      await utimes(join(storage.root, 'Seventeen.md'), new Date(2026, 0, 1), new Date(2026, 0, 1));
      expect(await recoverStrayTemps(storage, at)).toEqual([
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
      expect(await recoverStrayTemps(storage, at)).toEqual([
        'Fic/Lost (recovered 2026-10-19 16-40).md',
      ]);
    });

    it('drops a temp file older than its note, or holding the same words, or empty', async () => {
      await writeFile(join(storage.root, tempNameOf('Old.md')), 'Older draft.');
      await utimes(
        join(storage.root, tempNameOf('Old.md')),
        new Date(2026, 0, 1),
        new Date(2026, 0, 1),
      );
      await storage.write('Old.md', 'Current.', null);
      await storage.write('Same.md', 'Same.', null);
      await writeFile(join(storage.root, tempNameOf('Same.md')), 'Same.');
      await writeFile(join(storage.root, tempNameOf('Empty.md')), '');
      expect(await recoverStrayTemps(storage, at)).toEqual([]);
      expect((await readdir(storage.root)).sort()).toEqual(['Old.md', 'Same.md']);
    });

    it('leaves hidden folders alone', async () => {
      await mkdir(join(storage.root, '.git'));
      await writeFile(join(storage.root, '.git', tempNameOf('x.md')), 'not ours');
      expect(await recoverStrayTemps(storage, at)).toEqual([]);
      expect(await readdir(join(storage.root, '.git'))).toEqual([tempNameOf('x.md')]);
    });
  });
});
