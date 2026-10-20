// Adversarial: seals (spec §9) on a real folder — listFiles, which the window
// can now call through the bridge, kept inside the vault; and seal files
// other tools left there.

import { mkdir, mkdtemp, readdir, rename, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { namedVersionFile, parseVersionFile, type VersionFile } from '../../core/versions';
import { type DiskStorage, openDiskStorage } from './disk-storage';

const ID = 'ABCDEFGHJK';
const VERSIONS = `.eien/versions/${ID}`;

let root: string;
let outside: string;
let trash: string;
let storage: DiskStorage;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'eien-adv-versions-'));
  outside = await mkdtemp(join(tmpdir(), 'eien-adv-outside-'));
  trash = await mkdtemp(join(tmpdir(), 'eien-adv-trash-'));
  await writeFile(join(outside, 'secret.md'), 'not the vault’s');
  storage = await openDiskStorage(root, (path) => rename(path, join(trash, basename(path))));
});
afterEach(async () => {
  for (const dir of [root, outside, trash]) await rm(dir, { recursive: true, force: true });
});

describe('hardening: listFiles stays inside the vault', () => {
  it('refuses paths out of it, written any way', async () => {
    for (const folder of [
      '..',
      '../',
      `../${basename(outside)}`,
      outside,
      'C:\\Windows',
      'a\\..\\..',
      '.eien/../..',
    ]) {
      await expect(storage.listFiles(folder), folder).rejects.toThrow();
    }
  });

  it('refuses a versions folder, or a .eien, that is a link out of the vault', async () => {
    await mkdir(join(root, '.eien', 'versions'), { recursive: true });
    await symlink(outside, join(root, '.eien', 'versions', ID));
    await expect(storage.listFiles(VERSIONS)).rejects.toThrow();
    await rm(join(root, '.eien'), { recursive: true });
    await symlink(outside, join(root, '.eien'));
    await expect(storage.listFiles('.eien')).rejects.toThrow();
    await expect(storage.listFiles(VERSIONS)).rejects.toThrow();
  });

  it('leaves out a seal file that is a link, and a write’s hidden temp file', async () => {
    await mkdir(join(root, VERSIONS), { recursive: true });
    await writeFile(join(root, VERSIONS, '2026-10-19T16-40-02Z.md'), 'a seal');
    await symlink(join(outside, 'secret.md'), join(root, VERSIONS, '2026-10-19T16-40-03Z.md'));
    await writeFile(join(root, VERSIONS, '.2026-10-19T16-40-04Z.md.eien.tmp'), 'half');
    expect(await storage.listFiles(VERSIONS)).toEqual(['2026-10-19T16-40-02Z.md']);
    await expect(storage.read(`${VERSIONS}/2026-10-19T16-40-03Z.md`)).rejects.toThrow();
  });
});

describe('seals on disk', () => {
  // Windows can't hold such a name at all; the file comes from a Mac or a Linux machine.
  it.skipIf(process.platform === 'win32')(
    'listFiles leaves out a seal file whose name Eien can’t address, as list() leaves out such a note',
    async () => {
      // A seal named elsewhere with "?" in it is listed, then can't be read: when it's the newest, every ⌘S throws.
      await mkdir(join(root, VERSIONS), { recursive: true });
      await writeFile(join(root, VERSIONS, '2026-10-20T11-00-00Z--why?.md'), 'their seal');
      await writeFile(join(root, VERSIONS, '2026-10-20T10-00-00Z.md'), 'an older seal');
      await writeFile(join(root, 'Why?.md'), 'a note no system but this one can hold');
      expect((await storage.list()).map((entry) => entry.path)).not.toContain('Why?.md');
      const listed = await storage.listFiles(VERSIONS);
      for (const file of listed) {
        await expect(storage.read(`${VERSIONS}/${file}`), file).resolves.not.toBeNull();
      }
    },
  );

  it('hardening: a seal’s name changed only in case is renamed, not refused as taken', async () => {
    const sealed = '2026-10-20T12-00-00Z.md';
    await mkdir(join(root, VERSIONS), { recursive: true });
    await writeFile(join(root, VERSIONS, sealed), 'Words.');
    const named = namedVersionFile(parseVersionFile(sealed) as VersionFile, 'draft');
    expect(await storage.move(`${VERSIONS}/${sealed}`, `${VERSIONS}/${named}`)).toEqual({
      ok: true,
    });
    const renamed = namedVersionFile(parseVersionFile(named) as VersionFile, 'Draft');
    expect(await storage.move(`${VERSIONS}/${named}`, `${VERSIONS}/${renamed}`)).toEqual({
      ok: true,
    });
    expect(await readdir(join(root, VERSIONS))).toEqual(['2026-10-20T12-00-00Z--Draft.md']);
  });
});
