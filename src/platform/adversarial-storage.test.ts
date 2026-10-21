// Adversarial: the Storage contract under writes that overlap, and paths the
// disk and the test double disagree about. Same harness as storage.test.ts.

import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CapacitorStorage } from './capacitor/capacitor-storage';
import { NodeFiles } from './capacitor/node-files';
import { openDiskStorage } from './electron/disk-storage';
import { MemoryStorage } from './memory/memory-storage';
import type { Storage, WriteResult } from './storage';

interface Subject {
  storage: Storage;
  cleanup(): Promise<void>;
}

const implementations: Record<string, () => Promise<Subject>> = {
  memory: async () => ({ storage: new MemoryStorage(), cleanup: async () => {} }),
  // The phone's: Capacitor's file system played by Node's on a folder.
  capacitor: async () => {
    const root = await mkdtemp(join(tmpdir(), 'eien-adversarial-phone-'));
    return {
      storage: new CapacitorStorage(new NodeFiles(root), { pollMs: 20 }),
      cleanup: () => rm(root, { recursive: true, force: true }),
    };
  },
  disk: async () => {
    const root = await mkdtemp(join(tmpdir(), 'eien-adversarial-'));
    return {
      storage: await openDiskStorage(root),
      cleanup: () => rm(root, { recursive: true, force: true }),
    };
  },
};

/** A write's outcome, or the error it threw, so overlapping writes can be compared. */
const outcome = (write: Promise<WriteResult>) =>
  write.then(
    (result) => (result.ok ? 'written' : 'refused'),
    (error: unknown) => `threw ${String(error).slice(0, 40)}`,
  );

// The vault's settings, as setInVault writes them: "1 2 3", then back to the default.
const LONG = '{\n  "books.numerals": "arabic"\n}\n';
const SHORT = '{}\n';

for (const [name, make] of Object.entries(implementations)) {
  describe(`Storage contract, adversarial: ${name}`, () => {
    let subject: Subject;
    beforeEach(async () => {
      subject = await make();
    });
    afterEach(() => subject.cleanup());

    it('lets only one of two overlapping creates win, and keeps its words whole', async () => {
      const results = await Promise.all([
        outcome(subject.storage.write('config.json', LONG, null)),
        outcome(subject.storage.write('config.json', SHORT, null)),
      ]);
      expect(results.sort()).toEqual(['refused', 'written']);
      expect([LONG, SHORT]).toContain((await subject.storage.read('config.json'))?.text);
    });

    it('lets only one of two overlapping writes at the same version win', async () => {
      const first = await subject.storage.write('config.json', SHORT, null);
      if (!first.ok) throw new Error('create failed');
      const results = await Promise.all([
        outcome(subject.storage.write('config.json', LONG, first.version)),
        outcome(subject.storage.write('config.json', '{"x":1}\n', first.version)),
      ]);
      expect(results.sort()).toEqual(['refused', 'written']);
      expect([LONG, '{"x":1}\n']).toContain((await subject.storage.read('config.json'))?.text);
    });

    it('refuses to write a note inside something that is a note', async () => {
      await subject.storage.write('Note.md', 'Words.', null);
      await expect(subject.storage.write('Note.md/Inside.md', 'x', null)).rejects.toThrow();
      expect((await subject.storage.list()).map((entry) => `${entry.kind}:${entry.path}`)).toEqual([
        'note:Note.md',
      ]);
    });

    it('reads a path under a note as no file, as it reads any other missing file', async () => {
      await subject.storage.write('Note.md', 'Words.', null);
      expect(await subject.storage.read('Note.md/Inside.md')).toBeNull();
    });

    // Found by the model test (storage.property.test.ts): the disk and the test double disagreed.

    it('refuses a write at a version where no file can be, as where there is none', async () => {
      await subject.storage.write('Note.md', 'Words.', null);
      await subject.storage.write('Fic/One.md', 'One.', null);
      // No file there, so none at that version: refused, not thrown.
      expect(await subject.storage.write('Note.md/Inside.md', 'x', 'a version')).toEqual({
        ok: false,
        current: null,
      });
      expect(await subject.storage.write('Fic', 'x', 'a version')).toEqual({
        ok: false,
        current: null,
      });
    });

    it('lists a file’s size in bytes, as the disk counts it', async () => {
      await subject.storage.write('永遠.md', '永遠 🧣', null);
      const [entry] = await subject.storage.list();
      expect(entry?.size).toBe(new TextEncoder().encode('永遠 🧣').length);
    });
  });
}

describe('disk only, adversarial', () => {
  it('never leaves a mix of two overlapping writes in the file', async () => {
    const root = await mkdtemp(join(tmpdir(), 'eien-adversarial-'));
    try {
      const storage = await openDiskStorage(root);
      await Promise.all([
        outcome(storage.write('config.json', LONG, null)),
        outcome(storage.write('config.json', SHORT, null)),
      ]);
      expect(await readdir(root)).toEqual(['config.json']);
      const text = (await storage.read('config.json'))?.text ?? '';
      expect([LONG, SHORT]).toContain(text);
      expect(() => JSON.parse(text)).not.toThrow();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
