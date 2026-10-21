// Adversarial: Import Markdown Folder… on the disk (spec §8). "A link ...
// is never followed"; "a folder that is the vault ... is refused"; every file
// left out "is said to be". Each test fails on the code as it stands.

import { existsSync, rmSync, symlinkSync } from 'node:fs';
import { mkdir, mkdtemp, readdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OpenVault } from '../open-vault';
import { openDiskStorage } from './disk-storage';
import { ImportRefused, importFolder } from './import-folder';
import { listFolder } from './outside-folder';

let base: string;
let source: string;
let vaultRoot: string;
let vault: OpenVault;

async function put(root: string, files: Record<string, string>): Promise<void> {
  for (const [path, data] of Object.entries(files)) {
    const file = join(root, ...path.split('/'));
    await mkdir(join(file, '..'), { recursive: true });
    await writeFile(file, data);
  }
}

/** Every file's text under `root`. */
async function textsIn(root: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(root, { recursive: true, withFileTypes: true })) {
    if (entry.isFile()) out.push(await readFile(join(entry.parentPath, entry.name), 'utf8'));
  }
  return out;
}

/** Run `change` once the import has listed the folder, before it reads a note (Syncthing, a script). */
const hooks = vi.hoisted(() => ({ afterListing: null as null | (() => void) }));
vi.mock('./outside-folder', async (original) => {
  const actual = await original<typeof import('./outside-folder')>();
  return {
    ...actual,
    listFolder: async (...args: Parameters<typeof actual.listFolder>) => {
      const listed = await actual.listFolder(...args);
      hooks.afterListing?.();
      return listed;
    },
  };
});
function betweenListingAndReading(change: () => void): void {
  hooks.afterListing = change;
}

beforeEach(async () => {
  base = await realpath(await mkdtemp(join(tmpdir(), 'eien-import-adv-')));
  source = join(base, 'Drafts');
  vaultRoot = join(base, 'Vault');
  await mkdir(source);
  await mkdir(vaultRoot);
  vault = await OpenVault.open('Vault', await openDiskStorage(vaultRoot));
});
afterEach(async () => {
  hooks.afterListing = null;
  await rm(base, { recursive: true, force: true });
});

describe('importFolder never follows a link', () => {
  it('when a listed note is replaced by a link before it is read', async () => {
    await put(source, { 'Ideas.md': 'My idea.' });
    await put(base, { 'secret.txt': 'SECRET: not a note of the folder imported' });
    betweenListingAndReading(() => {
      rmSync(join(source, 'Ideas.md'));
      symlinkSync(join(base, 'secret.txt'), join(source, 'Ideas.md'));
    });
    const report = await importFolder(source, vaultRoot, vault);
    expect((await textsIn(vaultRoot)).join('\n')).not.toContain('SECRET');
    expect(report.copied).toBe(0);
  });

  it('when a listed folder is replaced by a link before its notes are read', async () => {
    await put(source, { 'Part/Chapter.md': 'Chapter words.' });
    await put(base, { 'Elsewhere/Chapter.md': 'SECRET: another folder’s words' });
    betweenListingAndReading(() => {
      rmSync(join(source, 'Part'), { recursive: true });
      symlinkSync(join(base, 'Elsewhere'), join(source, 'Part'));
    });
    await importFolder(source, vaultRoot, vault);
    expect((await textsIn(vaultRoot)).join('\n')).not.toContain('SECRET');
  });
});

describe('importFolder refuses the vault', () => {
  // macOS reaches every folder of the data volume by a second path too (a firmlink, not a
  // symlink), which realpath keeps as it is: the same folder, the same inode.
  const firm = (path: string) => `/System/Volumes/Data${path}`;
  it.runIf(process.platform === 'darwin')(
    'when it is chosen by its other path on macOS (/System/Volumes/Data/…)',
    async () => {
      await put(vaultRoot, { 'Mine.md': 'My own words.' });
      vault = await OpenVault.open('Vault', await openDiskStorage(vaultRoot));
      expect(existsSync(firm(vaultRoot))).toBe(true);
      await expect(importFolder(firm(vaultRoot), vaultRoot, vault)).rejects.toBeInstanceOf(
        ImportRefused,
      );
      expect(await readdir(vaultRoot)).toEqual(['Mine.md']); // no "Vault" folder copied into itself
    },
  );
});

describe('listFolder says what it leaves', () => {
  // Decided in the fixes for this pass: past the most files one import looks at, the listing
  // stops, and says where: that file, and everything after it, wasn't looked at (spec §8).
  // Asked for at a small most here, as 100,000 files take minutes to make on Windows.
  it('says where it stopped looking, past the most it lists', async () => {
    await put(source, {
      'a.png': '',
      'b.png': '',
      'z1.md': 'One.',
      'z2.md': 'Two.',
      'z3.md': 'Three.',
    });
    const listed = await listFolder(source, 3);
    expect(listed.files.map((file) => file.path)).toEqual(['a.png', 'b.png', 'z1.md']);
    expect(listed.left).toEqual([{ path: 'z2.md', reason: 'not-looked-at' }]);
  });
});
