// Adversarial: this device's settings file when it can't be read for a
// moment (permissions, or on Windows a virus scan holding it open). Spec §6:
// writing a file changes one key and keeps every other key as it is.

import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const where = vi.hoisted(() => ({ userData: '' }));
vi.mock('electron', () => ({ app: { getPath: () => where.userData, getAppPath: () => '' } }));

const { readDeviceFile, updateDeviceFile } = await import('./device-settings');

/** chmod can't make a file unreadable on Windows, or to root. */
const unreadable = process.platform === 'win32' || process.getuid?.() === 0;

describe('updateDeviceFile', () => {
  beforeEach(async () => {
    where.userData = await mkdtemp(join(tmpdir(), 'eien-device-'));
    // A separate copy's: the file in the data folder (./device-settings.test.ts has the installed one's).
    vi.stubEnv('EIEN_USER_DATA', where.userData);
  });
  afterEach(async () => {
    vi.unstubAllEnvs();
    await chmod(join(where.userData, 'settings.json'), 0o644).catch(() => {});
    await rm(where.userData, { recursive: true, force: true });
  });

  it.skipIf(unreadable)('never drops the other keys of a file it could not read', async () => {
    const file = join(where.userData, 'settings.json');
    const before = { vault: '/Users/me/Vault', settings: { 'appearance.face': 'literata' } };
    await writeFile(file, JSON.stringify(before));
    await chmod(file, 0o000); // there, valid, but unreadable just now
    await updateDeviceFile((data) => ({ ...data, settings: { 'page.zoom': 120 } })).catch(
      () => {}, // refusing the change is fine; wiping the file is not
    );
    await chmod(file, 0o644);
    const after = JSON.parse(await readFile(file, 'utf8')) as Record<string, unknown>;
    expect(after.vault).toBe('/Users/me/Vault');
  });

  it.skipIf(unreadable)(
    'refuses the change, and says why, rather than write over a file it couldn’t read',
    async () => {
      const file = join(where.userData, 'settings.json');
      await writeFile(file, '{"vault":"/v"}');
      await chmod(file, 0o000);
      await expect(updateDeviceFile((data) => ({ ...data, x: 1 }))).rejects.toThrow();
    },
  );

  it.skipIf(unreadable)(
    'opens with the defaults when the file can’t be read, and keeps a later change working',
    async () => {
      const file = join(where.userData, 'settings.json');
      await writeFile(file, '{"vault":"/v"}');
      await chmod(file, 0o000);
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      expect(await readDeviceFile()).toEqual({});
      warn.mockRestore();
      await chmod(file, 0o644);
      await updateDeviceFile((data) => ({ ...data, x: 1 }));
      expect(JSON.parse(await readFile(file, 'utf8'))).toEqual({ vault: '/v', x: 1 });
    },
  );

  it('reads a file with a byte-order mark, and starts afresh from one that isn’t JSON', async () => {
    const file = join(where.userData, 'settings.json');
    await writeFile(file, '\uFEFF{"vault":"/v"}');
    expect(await readDeviceFile()).toEqual({ vault: '/v' });
    await writeFile(file, 'not json');
    await updateDeviceFile((data) => ({ ...data, x: 1 }));
    expect(JSON.parse(await readFile(file, 'utf8'))).toEqual({ x: 1 });
  });
});
