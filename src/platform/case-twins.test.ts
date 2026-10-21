// Case twins (spec §3): on a system that tells case apart (Linux, iOS), no
// storage makes a name another entry in its folder has under another case.
// macOS, Windows and Android's shared storage ignore case, so Syncthing
// couldn't bring both there. Run on a volume that tells case apart.

import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { caseVolume } from '../../tests/case-folder';
import { CapacitorStorage } from './capacitor/capacitor-storage';
import { NodeFiles } from './capacitor/node-files';
import { recoverStrays as recoverOnPhone } from './capacitor/recover';
import { openDiskStorage } from './electron/disk-storage';
import { recoverStrays as recoverOnDisk } from './electron/recover-strays';
import { MemoryStorage } from './memory/memory-storage';
import type { Storage } from './storage';

const volume = await caseVolume();
afterAll(() => volume?.close());

interface Subject {
  storage: Storage;
  /** Put a file in place as another program would. */
  put(path: string, text: string): Promise<void>;
  /** What a crash left, put back as the vault opens; none in memory. */
  recover?(): Promise<string[]>;
}

const onDisk = async (root: string) => ({
  put: async (path: string, text: string) => {
    const file = join(root, ...path.split('/'));
    await mkdir(join(file, '..'), { recursive: true });
    await writeFile(file, text);
  },
});

const subjects: Record<string, (root: string) => Promise<Subject>> = {
  memory: async () => {
    const storage = new MemoryStorage(); // a Map: it tells case apart
    return { storage, put: async (path, text) => storage.put(path, text) };
  },
  disk: async (root) => {
    const storage = await openDiskStorage(root);
    return { storage, ...(await onDisk(root)), recover: () => recoverOnDisk(storage) };
  },
  capacitor: async (root) => {
    const files = new NodeFiles(root);
    const storage = new CapacitorStorage(files, { pollMs: 20 });
    return { storage, ...(await onDisk(root)), recover: () => recoverOnPhone(files, storage) };
  },
};

for (const [name, make] of Object.entries(subjects)) {
  describe.skipIf(volume === null)(`case twins, on a disk that tells case apart: ${name}`, () => {
    let subject: Subject;
    let root: string;
    beforeEach(async () => {
      root = (await volume?.folder()) ?? '';
      subject = await make(root);
    });
    afterEach(async () => {
      // Nothing ever made a twin: the vault as the storage lists it, exactly.
      const paths = (await subject.storage.list()).map((entry) => entry.path.toLowerCase());
      expect(new Set(paths).size).toBe(paths.length);
    });

    const paths = async () => (await subject.storage.list()).map((entry) => entry.path).sort();

    it('a new note never takes a name that’s there in another case', async () => {
      await subject.put('Chapter.md', 'Mine.');
      const result = await subject.storage.write('chapter.md', 'Another note.', null);
      expect(result).toEqual({ ok: false, current: await subject.storage.read('Chapter.md') });
      expect(await paths()).toEqual(['Chapter.md']);
      expect((await subject.storage.read('Chapter.md'))?.text).toBe('Mine.');
    });

    it('nor a new image', async () => {
      await subject.put('Art/scarf.png', 'PNG');
      expect(await subject.storage.writeNew('Art/scarf.PNG', new Uint8Array([1]))).toBe(false);
      expect(await subject.storage.writeNew('ART/other.png', new Uint8Array([1]))).toBe(false);
      expect(await paths()).toEqual(['Art', 'Art/scarf.png']);
    });

    it('a move never lands on a name that’s there in another case', async () => {
      await subject.put('Draft.md', 'Draft.');
      await subject.put('Chapter.md', 'Chapter.');
      expect(await subject.storage.move('Draft.md', 'chapter.md')).toEqual({
        ok: false,
        reason: 'taken',
      });
      expect(await paths()).toEqual(['Chapter.md', 'Draft.md']);
    });

    it('nor makes a folder that’s there in another case, to move or write into', async () => {
      await subject.put('Fic/One.md', 'One.');
      await subject.put('Two.md', 'Two.');
      expect(await subject.storage.move('Two.md', 'fic/Two.md')).toEqual({
        ok: false,
        reason: 'taken',
      });
      expect(await subject.storage.move('Two.md', 'FIC/Deep/Two.md')).toEqual({
        ok: false,
        reason: 'taken',
      });
      expect(await subject.storage.write('fic/Three.md', 'Three.', null)).toEqual({
        ok: false,
        current: null,
      });
      expect(await subject.storage.writeNew('fic/art.png', new Uint8Array([1]))).toBe(false);
      await expect(subject.storage.makeFolder('fic')).rejects.toThrow();
      await expect(subject.storage.makeFolder('fIC/Deep')).rejects.toThrow();
      expect(await paths()).toEqual(['Fic', 'Fic/One.md', 'Two.md']);
    });

    it('renames by case alone, a note or a folder: the same entry', async () => {
      await subject.put('chapter.md', 'Words.');
      await subject.put('fic/One.md', 'One.');
      expect(await subject.storage.move('chapter.md', 'Chapter.md')).toEqual({ ok: true });
      expect(await subject.storage.move('fic', 'Fic')).toEqual({ ok: true });
      expect(await subject.storage.move('Fic/One.md', 'Fic/one.md')).toEqual({ ok: true });
      expect(await paths()).toEqual(['Chapter.md', 'Fic', 'Fic/one.md']);
    });

    it('twins another device made are each still there to save, and to rename apart', async () => {
      // Made where case counts, as Linux keeps them: Eien leaves both, and doesn't add a third.
      await subject.put('Chapter.md', 'One.');
      await subject.put('chapter.md', 'Two.');
      const two = await subject.storage.read('chapter.md');
      const saved = await subject.storage.write('chapter.md', 'Two, edited.', two?.version ?? null);
      expect(saved.ok).toBe(true);
      expect((await subject.storage.read('Chapter.md'))?.text).toBe('One.');
      expect(await subject.storage.move('chapter.md', 'CHAPTER.md')).toEqual({
        ok: false,
        reason: 'taken',
      });
      expect(await subject.storage.move('chapter.md', 'Chapter two.md')).toEqual({ ok: true });
      expect(await paths()).toEqual(['Chapter two.md', 'Chapter.md']);
    });

    it('recovery puts a step back beside its twin, never as one', async () => {
      if (!subject.recover) return; // memory: nothing a crash can leave
      await subject.put('.tear.md.eien-case', 'The scarf tore.');
      await subject.put('Tear.md', 'The scarf tore. And the phone kept writing.');
      const [back, ...more] = await subject.recover();
      expect(more).toEqual([]);
      expect(back).toMatch(/^tear \(recovered .+\)\.md$/u);
      expect((await subject.storage.read(back as string))?.text).toBe('The scarf tore.');
      expect((await readdir(root)).sort()).toEqual([back, 'Tear.md'].sort());
    });
  });
}
