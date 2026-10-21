// Importing a folder of Markdown (spec §8) on the disk: the notes come in
// as the plan names them, nothing in the vault is written over (even a file
// that arrives mid-import), the original is only read, and every file left
// out is said to be, with why.

import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readdir, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { OpenVault } from '../open-vault';
import { openDiskStorage } from './disk-storage';
import { ImportRefused, importFolder, listFolder } from './import-folder';

let base: string;
let source: string;
let vaultRoot: string;
let vault: OpenVault;

async function put(root: string, files: Record<string, string | Uint8Array>): Promise<void> {
  for (const [path, data] of Object.entries(files)) {
    const file = join(root, ...path.split('/'));
    await mkdir(join(file, '..'), { recursive: true });
    await writeFile(file, data);
  }
}

/** Every file under `root`, with a hash of its bytes: what "unchanged" means. */
async function snapshot(root: string): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const walk = async (folder: string) => {
    for (const entry of await readdir(join(root, folder), { withFileTypes: true })) {
      const path = folder ? `${folder}/${entry.name}` : entry.name;
      if (entry.isDirectory()) await walk(path);
      else if (entry.isFile()) {
        out[path] = createHash('sha256')
          .update(await readFile(join(root, path)))
          .digest('hex');
      } else out[path] = 'link';
    }
  };
  await walk('');
  return out;
}

beforeEach(async () => {
  base = await mkdtemp(join(tmpdir(), 'eien-import-'));
  source = join(base, 'Obsidian Notes');
  vaultRoot = join(base, 'Vault');
  await mkdir(source);
  await mkdir(vaultRoot);
  vault = await OpenVault.open('Vault', await openDiskStorage(vaultRoot));
});
afterEach(async () => {
  await rm(base, { recursive: true, force: true });
});

describe('importFolder', () => {
  it('copies the notes into a new folder, their bytes as they were, and leaves the original alone', async () => {
    const crlf = '﻿---\r\ntags: [a]\r\n---\r\nLine one\r\n';
    await put(source, {
      'Ideas.md': '# Ideas\n\nOne.',
      'Old.txt': 'Plain text.',
      'Sub/Deep/Chapter.markdown': crlf,
      '.obsidian/workspace.json': '{}',
      'Sub/photo.png': new Uint8Array([137, 80, 78, 71]),
    });
    const before = await snapshot(source);
    const report = await importFolder(source, vaultRoot, vault);
    expect(report).toEqual({
      folder: 'Obsidian Notes',
      copied: 3,
      left: [{ path: 'Sub/photo.png', reason: 'not-a-note' }],
    });
    expect(await readFile(join(vaultRoot, 'Obsidian Notes/Ideas.md'), 'utf8')).toBe(
      '# Ideas\n\nOne.',
    );
    expect(await readFile(join(vaultRoot, 'Obsidian Notes/Old.md'), 'utf8')).toBe('Plain text.');
    expect(await readFile(join(vaultRoot, 'Obsidian Notes/Sub/Deep/Chapter.md'), 'utf8')).toBe(
      crlf,
    );
    expect(await snapshot(source)).toEqual(before);
    // The index holds them before the window asks.
    expect((await vault.notes()).map((note) => note.path).sort()).toEqual([
      'Obsidian Notes/Ideas.md',
      'Obsidian Notes/Old.md',
      'Obsidian Notes/Sub/Deep/Chapter.md',
    ]);
  });

  it('never writes over the vault: its own folder of that name stays, and the import is numbered', async () => {
    await put(vaultRoot, { 'Obsidian Notes/Ideas.md': 'Mine.' });
    vault = await OpenVault.open('Vault', await openDiskStorage(vaultRoot));
    await put(source, { 'Ideas.md': 'Theirs.' });
    const report = await importFolder(source, vaultRoot, vault);
    expect(report.folder).toBe('Obsidian Notes 2');
    expect(await readFile(join(vaultRoot, 'Obsidian Notes/Ideas.md'), 'utf8')).toBe('Mine.');
    expect(await readFile(join(vaultRoot, 'Obsidian Notes 2/Ideas.md'), 'utf8')).toBe('Theirs.');
  });

  it('never writes over a file the vault’s listing hasn’t caught up with', async () => {
    await put(source, { 'Ideas.md': 'Imported.' });
    // Written after the vault was read, before the watcher said: the plan thinks the name is free.
    await put(vaultRoot, { 'Obsidian Notes/Ideas.md': 'Synced.' });
    const report = await importFolder(source, vaultRoot, vault);
    expect(report.folder).toBe('Obsidian Notes');
    expect(await readFile(join(vaultRoot, 'Obsidian Notes/Ideas.md'), 'utf8')).toBe('Synced.');
    expect(await readFile(join(vaultRoot, 'Obsidian Notes/Ideas 2.md'), 'utf8')).toBe('Imported.');
  });

  it('numbers a note when a file arrives at its name mid-import, keeping both', async () => {
    await put(source, { 'Ideas.md': 'Imported.' });
    const write = vault.storage.write.bind(vault.storage);
    let arrived = false;
    vault.storage.write = async (path, text, expected) => {
      if (!arrived) {
        arrived = true; // Syncthing, a moment before the first write
        await put(vaultRoot, { [path]: 'Synced.' });
      }
      return write(path, text, expected);
    };
    const report = await importFolder(source, vaultRoot, vault);
    expect(report.copied).toBe(1);
    expect(await readFile(join(vaultRoot, 'Obsidian Notes/Ideas.md'), 'utf8')).toBe('Synced.');
    expect(await readFile(join(vaultRoot, 'Obsidian Notes/Ideas 2.md'), 'utf8')).toBe('Imported.');
  });

  it('leaves out, and says why: too large, not UTF-8, a bad name, a link', async () => {
    await put(source, {
      'Big.md': 'x'.repeat(8 * 1024 * 1024 + 1),
      'Latin1.md': new Uint8Array([0x63, 0x61, 0x66, 0xe9]),
      'Fine.md': 'Fine.',
    });
    await symlink(join(source, 'Fine.md'), join(source, 'Linked.md')).catch(() => undefined);
    const report = await importFolder(source, vaultRoot, vault);
    expect(report.copied).toBe(1);
    const left = report.left.filter((each) => each.path !== 'Linked.md');
    expect(left).toEqual([
      { path: 'Big.md', reason: 'too-large' },
      { path: 'Latin1.md', reason: 'not-utf8' },
    ]);
    const linked = await stat(join(source, 'Linked.md')).catch(() => null);
    if (linked) expect(report.left).toContainEqual({ path: 'Linked.md', reason: 'link' });
  });

  it('makes nothing when no note comes in', async () => {
    await put(source, { 'photo.png': 'png' });
    const report = await importFolder(source, vaultRoot, vault);
    expect(report).toEqual({
      folder: null,
      copied: 0,
      left: [{ path: 'photo.png', reason: 'not-a-note' }],
    });
    expect(await readdir(vaultRoot)).toEqual([]);
  });

  it('refuses the vault itself, a folder in it, and a folder holding it', async () => {
    await mkdir(join(vaultRoot, 'Inside'));
    for (const folder of [vaultRoot, join(vaultRoot, 'Inside'), base]) {
      await expect(importFolder(folder, vaultRoot, vault)).rejects.toBeInstanceOf(ImportRefused);
    }
    // A sibling whose name starts like the vault's is not inside it.
    await mkdir(join(base, 'Vault2'));
    await put(join(base, 'Vault2'), { 'A.md': 'a' });
    expect((await importFolder(join(base, 'Vault2'), vaultRoot, vault)).copied).toBe(1);
  });
});

describe('listFolder', () => {
  it('lists every file in order, hidden ones left out, folders looked into', async () => {
    await put(source, { 'b.md': '', 'a/c.md': '', '.git/HEAD': '', 'a/.DS_Store': '' });
    expect(await listFolder(source)).toEqual({
      files: [
        { path: 'a/c.md', size: 0 },
        { path: 'b.md', size: 0 },
      ],
      left: [],
    });
  });
});
