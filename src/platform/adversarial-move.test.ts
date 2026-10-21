// Adversarial: the Storage contract's move and makeFolder (phase 6b), at the
// name-length limit and where the disk and the test double disagree.

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { isValidName, renamedPath } from '../core/paths';
import { utf8Length } from '../core/paths/names';
import { CapacitorStorage } from './capacitor/capacitor-storage';
import { NodeFiles } from './capacitor/node-files';
import { openDiskStorage } from './electron/disk-storage';
import { MemoryStorage } from './memory/memory-storage';
import type { Storage } from './storage';

interface Subject {
  storage: Storage;
  cleanup(): Promise<void>;
}

const implementations: Record<string, () => Promise<Subject>> = {
  memory: async () => ({ storage: new MemoryStorage(), cleanup: async () => {} }),
  // The phone's: Capacitor's file system played by Node's on a folder.
  capacitor: async () => {
    const root = await mkdtemp(join(tmpdir(), 'eien-adv-move-phone-'));
    return {
      storage: new CapacitorStorage(new NodeFiles(root), { pollMs: 20 }),
      cleanup: () => rm(root, { recursive: true, force: true }),
    };
  },
  disk: async () => {
    const root = await mkdtemp(join(tmpdir(), 'eien-adv-move-'));
    return {
      storage: await openDiskStorage(root),
      cleanup: () => rm(root, { recursive: true, force: true }),
    };
  },
};

for (const [name, make] of Object.entries(implementations)) {
  describe(`Storage, adversarial (phase 6b): ${name}`, () => {
    let subject: Subject;
    beforeEach(async () => {
      subject = await make();
    });
    afterEach(() => subject.cleanup());

    it('saves a note renamed to the longest title the rename allows', async () => {
      // The writer pastes a long first sentence as the title: renamedPath cuts it, leaving
      // room for the 19 bytes a save's temp file adds.
      await subject.storage.write('Note.md', 'Words.', null);
      const renamed = renamedPath('Note.md', 'a'.repeat(300), [], true);
      if (!renamed.ok) throw new Error('refused');
      expect(utf8Length(renamed.path)).toBe(236);
      expect(isValidName(renamed.path)).toBe(true);
      expect(await subject.storage.move('Note.md', renamed.path)).toEqual({ ok: true });
      // The next autosave: its temp file ".<name>.<token>.eien.tmp" is 255 bytes, the most there is.
      const before = await subject.storage.read(renamed.path);
      const saved = await subject.storage
        .write(renamed.path, 'Words. And an hour more.', before?.version ?? null)
        .catch((error: unknown) => String(error));
      expect(saved).toEqual({ ok: true, version: expect.any(String) });
    });

    it('saves a note another program named with all 255 bytes', async () => {
      const name = `${'é'.repeat(126)}.md`; // 252 + 3 bytes
      expect(utf8Length(name)).toBe(255);
      expect((await subject.storage.write(name, 'First.', null)).ok).toBe(true);
      const first = await subject.storage.read(name);
      expect((await subject.storage.write(name, 'Second.', first?.version ?? null)).ok).toBe(true);
      expect((await subject.storage.read(name))?.text).toBe('Second.');
      expect((await subject.storage.list()).map((entry) => entry.path)).toEqual([name]); // no temp left
    });

    it('refuses a folder under a file, as the disk does', async () => {
      await subject.storage.write('Note.md', 'x', null);
      await expect(subject.storage.makeFolder('Note.md/Inside')).rejects.toThrow();
      expect((await subject.storage.list()).map((entry) => `${entry.kind}:${entry.path}`)).toEqual([
        'note:Note.md',
      ]);
    });
  });
}
