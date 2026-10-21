// Adversarial: the phone's Storage.writeNew when the disk fills while a new
// file's bytes go in (spec §11: a full disk, simulated). The phone's file
// system is Node's (as in the contract tests), its write cut off halfway.

import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CapacitorStorage } from './capacitor-storage';
import { NodeFiles } from './node-files';

/** Node's files, but a new file's temp takes half its bytes and then the disk is full. */
class FullDisk extends NodeFiles {
  override async writeBytes(path: string, bytes: Uint8Array): Promise<void> {
    if (!path.endsWith('.eien-new')) return super.writeBytes(path, bytes);
    await super.writeBytes(path, bytes.subarray(0, bytes.length >> 1));
    throw new Error('ENOSPC: no space left on device');
  }
}

describe('CapacitorStorage.writeNew, adversarial', () => {
  let root: string;
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'eien-adv-phone-new-'));
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('leaves no half-written temp file in the vault when the disk fills', async () => {
    const storage = new CapacitorStorage(new FullDisk(root));
    const bytes = Uint8Array.from({ length: 4096 }, (_, i) => i & 255);
    await expect(storage.writeNew('Art/scarf.png', bytes)).rejects.toThrow(/ENOSPC/u);
    // Today ".scarf.png.eien-new", half the image, stays: Syncthing takes it to every device.
    expect(await readdir(join(root, 'Art'))).toEqual([]);
  });
});
