// Where a copy of Eien keeps its data: a separate copy's own folder first,
// then a portable copy's folder beside it, else as installed.

import { chmodSync, existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it, vi } from 'vitest';
import type { Copy } from './data-folders';

vi.mock('electron', () => ({ app: {} }));
const {
  DOCUMENTS_FOLDER,
  PORTABLE_FOLDER,
  dataFolder,
  isWithin,
  prepareDataFolder,
  settingsFolder,
} = await import('./data-folders');

const root = mkdtempSync(join(tmpdir(), 'eien-folders-'));
afterAll(() => {
  chmodSync(root, 0o755);
  rmSync(root, { recursive: true, force: true });
});

const copy = (over: Partial<Copy> = {}): Copy => ({
  env: {},
  platform: 'linux',
  portable: false,
  exe: join(root, 'eien'),
  ...over,
});
const macApp = join(root, 'Writing', 'Eien.app', 'Contents', 'MacOS', 'Eien');

describe('dataFolder', () => {
  it('is a separate copy’s own folder first, even for a portable copy', () => {
    const own = join(root, 'tests');
    expect(dataFolder(copy({ env: { EIEN_USER_DATA: own }, portable: true }))).toBe(own);
  });

  it('is “Eien Data” beside a portable Mac app', () => {
    const mac = copy({ platform: 'darwin', portable: true, exe: macApp });
    expect(dataFolder(mac)).toBe(join(root, 'Writing', PORTABLE_FOLDER));
  });

  it('is beside the portable Windows .exe its launcher names, not the temp copy it runs', () => {
    const usb = join(root, 'USB');
    const win = copy({
      platform: 'win32',
      portable: true,
      exe: join(root, 'Temp', 'eien-abc', 'Eien.exe'),
      env: { PORTABLE_EXECUTABLE_DIR: usb },
    });
    expect(dataFolder(win)).toBe(join(usb, PORTABLE_FOLDER));
  });

  it('is Electron’s own for an installed copy, or one run from source', () => {
    expect(dataFolder(copy({ platform: 'darwin', exe: macApp }))).toBeNull();
    expect(
      dataFolder(copy({ platform: 'win32', env: { PORTABLE_EXECUTABLE_DIR: root } })),
    ).toBeNull();
  });
});

describe('settingsFolder', () => {
  const userData = join(root, 'userData');
  const documents = join(root, 'Documents');

  it('is Documents/Eien for an installed copy', () => {
    expect(settingsFolder(copy(), userData, documents)).toBe(join(documents, DOCUMENTS_FOLDER));
  });

  it('is the data folder for a portable or separate copy', () => {
    expect(settingsFolder(copy({ portable: true }), userData, documents)).toBe(userData);
    expect(settingsFolder(copy({ env: { EIEN_USER_DATA: userData } }), userData, documents)).toBe(
      userData,
    );
  });
});

describe('isWithin', () => {
  const eien = join(root, 'Documents', 'Eien');
  const file = join(eien, 'settings.json');

  it('holds the folder itself and what is inside it, at any depth', () => {
    expect(isWithin(eien, file, 'linux')).toBe(true);
    expect(isWithin(join(root, 'Documents'), file, 'linux')).toBe(true);
    expect(isWithin(eien, eien, 'linux')).toBe(true);
  });

  it('holds nothing beside it, or above it, even with the same start to its name', () => {
    expect(isWithin(join(eien, 'Vault'), file, 'linux')).toBe(false);
    expect(isWithin(`${eien}2`, join(`${eien}2x`, 'settings.json'), 'linux')).toBe(false);
    expect(isWithin(join(root, 'Documents', 'Eie'), file, 'linux')).toBe(false);
  });

  it('ignores case where the system does', () => {
    const shouted = join(root, 'DOCUMENTS', 'EIEN');
    expect(isWithin(shouted, file, 'darwin')).toBe(true);
    expect(isWithin(shouted, file, 'win32')).toBe(true);
    expect(isWithin(shouted, file, 'linux')).toBe(false);
  });
});

/** chmod can't stop a write on Windows, or for root. */
const unwritable = process.platform === 'win32' || process.getuid?.() === 0;

describe('prepareDataFolder', () => {
  it('makes the folder, and has nothing to say', () => {
    const folder = join(root, 'Stick', PORTABLE_FOLDER);
    expect(prepareDataFolder(folder)).toBeNull();
    expect(existsSync(folder)).toBe(true);
  });

  it.skipIf(unwritable)('says plainly where it can’t write, rather than go elsewhere', () => {
    const locked = join(root, 'Locked');
    mkdirSync(locked);
    chmodSync(locked, 0o555);
    const folder = join(locked, PORTABLE_FOLDER);
    expect(prepareDataFolder(folder)).toContain(folder);
    expect(existsSync(folder)).toBe(false);
  });

  it.skipIf(unwritable)('tells a downloaded Mac app to be moved once', () => {
    const translocated = join(root, 'AppTranslocation', 'D5C8');
    mkdirSync(translocated, { recursive: true });
    chmodSync(translocated, 0o555);
    expect(prepareDataFolder(join(translocated, PORTABLE_FOLDER))).toMatch(/move it with Finder/);
  });
});
