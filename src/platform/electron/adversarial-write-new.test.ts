// Adversarial: DiskStorage.writeNew, an imported image's bytes (Storage
// contract: "false, and nothing written, when something is there already";
// spec §11: a full disk, simulated). The full disk is played by a hook on
// `open`: the next temp file opened takes half its bytes, then the disk is full.

import { mkdir, mkdtemp, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type DiskStorage, openDiskStorage } from './disk-storage';

const disk = vi.hoisted(() => ({ full: false }));

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...actual,
    open: async (...args: Parameters<typeof actual.open>) => {
      const handle = await actual.open(...args);
      if (!disk.full || !String(args[0]).endsWith('.eien-new')) return handle;
      disk.full = false;
      return {
        writeFile: async (data: Uint8Array) => {
          await handle.write(data.subarray(0, data.length >> 1));
          throw Object.assign(new Error('ENOSPC: no space left on device, write'), {
            code: 'ENOSPC',
          });
        },
        sync: () => handle.sync(),
        close: () => handle.close(),
      };
    },
  };
});

describe('DiskStorage.writeNew, adversarial', () => {
  let root: string;
  let storage: DiskStorage;
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'eien-adv-new-'));
    storage = await openDiskStorage(root);
  });
  afterEach(async () => {
    disk.full = false;
    await rm(root, { recursive: true, force: true });
  });

  it('leaves no half-written temp file in the vault when the disk fills', async () => {
    disk.full = true;
    const bytes = Uint8Array.from({ length: 4096 }, (_, i) => i & 255);
    await expect(storage.writeNew('Art/scarf.png', bytes)).rejects.toThrow(/ENOSPC/u);
    // Today ".scarf.png.eien-new", half the image, stays (and Syncthing carries it off).
    expect(await readdir(join(root, 'Art'))).toEqual([]);
  });

  it.skipIf(process.platform === 'win32')(
    'answers false, not an error, when a link is already at the name',
    async () => {
      // Syncthing brings a symbolic link in at the image's name: something is there.
      await writeFile(join(root, 'elsewhere.png'), 'theirs');
      await mkdir(join(root, 'Art'));
      await symlink(join(root, 'elsewhere.png'), join(root, 'Art', 'scarf.png'));
      // Today it throws "a symbolic link", so the import says "couldn't be written"
      // instead of numbering the image, as spec §8 has an arrival numbered.
      await expect(storage.writeNew('Art/scarf.png', new Uint8Array([1]))).resolves.toBe(false);
    },
  );
});
