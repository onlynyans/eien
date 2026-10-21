// This device's settings file: in Documents/Eien for an installed copy,
// moved there once from the data folder, never over a newer one, and never
// into the vault that's open.

import { existsSync, mkdirSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const where = vi.hoisted(() => ({ userData: '', documents: '' }));
const told = vi.hoisted(() => vi.fn(async () => ({ response: 0 })));
vi.mock('electron', () => ({
  app: {
    getPath: (name: string) => (name === 'documents' ? where.documents : where.userData),
    getAppPath: () => where.userData, // no package.json there: not a portable build
    isPackaged: false,
  },
  BrowserWindow: { getAllWindows: () => [] },
  dialog: { showMessageBox: told },
}));

const { readDeviceFile, updateDeviceFile } = await import('./device-settings');

let root = '';
const old = () => join(where.userData, 'settings.json');
const home = () => join(where.documents, 'Eien', 'settings.json');
const put = async (file: string, data: unknown) => {
  mkdirSync(join(file, '..'), { recursive: true });
  await writeFile(file, JSON.stringify(data));
};
const json = async (file: string) => JSON.parse(await readFile(file, 'utf8'));

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'eien-device-'));
  where.userData = join(root, 'userData');
  where.documents = join(root, 'Documents');
  mkdirSync(where.userData);
  vi.stubEnv('EIEN_USER_DATA', '');
  told.mockClear();
});
afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(root, { recursive: true, force: true });
});

describe('an installed copy’s settings file', () => {
  it('is moved once from the data folder to Documents/Eien', async () => {
    const chosen = { vault: join(root, 'Novel'), settings: { 'appearance.face': 'literata' } };
    await put(old(), chosen);
    expect(await readDeviceFile()).toEqual(chosen);
    expect(await json(home())).toEqual(chosen);
    expect(existsSync(old())).toBe(false);
    expect(await readDeviceFile()).toEqual(chosen);
  });

  it('never writes over one already in Documents/Eien', async () => {
    await put(home(), { vault: join(root, 'Newer') });
    await put(old(), { vault: join(root, 'Older') });
    expect(await readDeviceFile()).toEqual({ vault: join(root, 'Newer') });
    await updateDeviceFile((data) => ({ ...data, x: 1 }));
    expect(await json(home())).toEqual({ vault: join(root, 'Newer'), x: 1 });
    expect(await json(old())).toEqual({ vault: join(root, 'Older') });
  });

  it('is written in Documents/Eien, making the folder', async () => {
    await updateDeviceFile((data) => ({ ...data, vault: join(root, 'Novel') }));
    expect(await json(home())).toEqual({ vault: join(root, 'Novel') });
    expect(existsSync(old())).toBe(false);
  });

  it('stays out of a vault that holds Documents/Eien, and says so once', async () => {
    await put(home(), { vault: join(root, 'Before') });
    const vault = join(where.documents, 'Eien');
    await updateDeviceFile((data) => ({ ...data, vault }));
    await updateDeviceFile((data) => ({ ...data, x: 1 }));
    expect(await json(old())).toEqual({ vault, x: 1 });
    expect(await json(home())).toEqual({ vault: join(root, 'Before') }); // not written into the vault
    expect(await readDeviceFile()).toEqual({ vault, x: 1 });
    expect(told).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(told.mock.calls)).toContain(where.userData);
  });

  it('stays out of a vault that holds Documents itself', async () => {
    await updateDeviceFile((data) => ({ ...data, vault: where.documents }));
    expect(existsSync(home())).toBe(false);
    expect(await json(old())).toEqual({ vault: where.documents });
  });

  it('goes back to Documents/Eien when the vault no longer holds it', async () => {
    await updateDeviceFile((data) => ({ ...data, vault: join(where.documents, 'Eien') }));
    await updateDeviceFile((data) => ({ ...data, vault: join(where.documents, 'Eien', 'Vault') }));
    expect(await json(home())).toEqual({ vault: join(where.documents, 'Eien', 'Vault') });
    expect(existsSync(old())).toBe(false);
    expect(told).toHaveBeenCalledTimes(1);
  });
});

describe('a separate copy’s settings file (EIEN_USER_DATA)', () => {
  it('stays in its data folder, and Documents is left alone', async () => {
    vi.stubEnv('EIEN_USER_DATA', where.userData);
    await updateDeviceFile((data) => ({ ...data, x: 1 }));
    expect(await json(old())).toEqual({ x: 1 });
    expect(existsSync(where.documents)).toBe(false);
  });
});
