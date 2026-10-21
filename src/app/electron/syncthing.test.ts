import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { syncedBySyncthing } from './syncthing';

const made: string[] = [];
const folder = () => {
  const at = mkdtempSync(join(tmpdir(), 'eien-syncthing-'));
  made.push(at);
  return at;
};
afterEach(() => {
  for (const at of made.splice(0)) rmSync(at, { recursive: true, force: true });
});

describe('syncedBySyncthing', () => {
  it('a vault with Syncthing’s marker in it is synced', async () => {
    const vault = folder();
    mkdirSync(join(vault, '.stfolder'));
    expect(await syncedBySyncthing(vault)).toBe(true);
  });

  it('a vault inside a synced folder is synced; the marker may be a file (older Syncthing)', async () => {
    const top = folder();
    writeFileSync(join(top, '.stfolder'), '');
    const vault = join(top, 'Documents', 'My Vault');
    mkdirSync(vault, { recursive: true });
    expect(await syncedBySyncthing(vault)).toBe(true);
  });

  it('a vault with no marker anywhere above it isn’t', async () => {
    const vault = join(folder(), 'My Vault');
    mkdirSync(vault);
    // The temp folder's own parents could hold a marker on a developer's machine: only this
    // vault's answer when none of them do is asserted.
    const above = await syncedBySyncthing(join(vault, '..', '..'));
    expect(await syncedBySyncthing(vault)).toBe(above);
  });
});
