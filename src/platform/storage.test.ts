// The Storage contract (spec §11): the same tests against every
// implementation, so the disk and the test double can't drift apart.

import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  symlink,
  utimes,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { VaultPathError } from '../core/paths';
import { type DiskStorage, openDiskStorage, tempNameOf } from './electron/disk-storage';
import { recoverStrayTemps } from './electron/recover-temps';
import { MemoryStorage } from './memory/memory-storage';
import type { Storage } from './storage';

interface Subject {
  storage: Storage;
  /** Change a file as another program would. */
  putOutside(path: string, text: string): Promise<void>;
  cleanup(): Promise<void>;
}

const implementations: Record<string, () => Promise<Subject>> = {
  memory: async () => {
    const storage = new MemoryStorage();
    return {
      storage,
      putOutside: async (path, text) => storage.put(path, text),
      cleanup: async () => {},
    };
  },
  disk: async () => {
    const root = await mkdtemp(join(tmpdir(), 'eien-storage-'));
    const storage = await openDiskStorage(root);
    return {
      storage,
      putOutside: async (path, text) => {
        const file = join(storage.root, ...path.split('/'));
        await mkdir(join(file, '..'), { recursive: true });
        await writeFile(file, text);
      },
      cleanup: () => rm(root, { recursive: true, force: true }),
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

    it('tells a watcher what changed', async () => {
      const seen: string[] = [];
      const stop = subject.storage.watch((paths) => seen.push(...paths));
      try {
        await subject.putOutside('Watched.md', 'changed');
        await expect.poll(() => seen, { timeout: 3000 }).toContain('Watched.md');
      } finally {
        stop();
      }
    });

    it('tells a watcher about the vault’s settings, and no other hidden file', async () => {
      const seen: string[] = [];
      const stop = subject.storage.watch((paths) => seen.push(...paths));
      try {
        await subject.putOutside('.eien/other.json', '{}');
        await subject.putOutside('Fic/.hidden.md', 'x');
        await subject.putOutside('.eien/config.json', '{}');
        await subject.putOutside('Seen.md', 'x');
        await expect
          .poll(() => seen, { timeout: 3000 })
          .toEqual(expect.arrayContaining(['.eien/config.json', 'Seen.md']));
        const hidden = seen.filter((path) => path.split('/').some((name) => name.startsWith('.')));
        expect(new Set(hidden)).toEqual(new Set(['.eien/config.json']));
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
