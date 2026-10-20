// The vault a window has open, and the IPC that reaches it. Every argument
// from the window is checked here; the storage checks every path again.

import { basename } from 'node:path';
import { type BrowserWindow, dialog } from 'electron';
import { CHANNEL, type VaultInfo } from '../../platform/bridge';
import { type DiskStorage, openDiskStorage } from '../../platform/electron/disk-storage';
import { recoverStrayTemps } from '../../platform/electron/recover-temps';
import { lastVault, readDeviceFile, updateDeviceFile } from './device-settings';
import { answer, text } from './ipc';

export class VaultSession {
  #storage: DiskStorage | null = null;
  #stopWatching: (() => void) | null = null;
  readonly #window: BrowserWindow;

  constructor(window: BrowserWindow) {
    this.#window = window;
  }

  get info(): VaultInfo | null {
    return this.#storage ? { name: basename(this.#storage.root) } : null;
  }

  /** Open the folder at `root`: recover anything a crash left, then watch it. */
  async open(root: string): Promise<VaultInfo> {
    const storage = await openDiskStorage(root);
    await recoverStrayTemps(storage);
    this.close();
    this.#storage = storage;
    this.#stopWatching = storage.watch((paths) => {
      if (!this.#window.isDestroyed()) this.#window.webContents.send(CHANNEL.changed, paths);
    });
    return { name: basename(storage.root) };
  }

  close(): void {
    this.#stopWatching?.();
    this.#stopWatching = null;
    this.#storage = null;
  }

  storage(): DiskStorage {
    if (!this.#storage) throw new Error('No vault is open.');
    return this.#storage;
  }
}

/**
 * Answer the window's vault requests. The vault to open first is
 * EIEN_VAULT (for tests and separate copies), else the one last opened.
 */
export async function serveVault(window: BrowserWindow): Promise<VaultSession> {
  const session = new VaultSession(window);
  const start = process.env.EIEN_VAULT || lastVault(await readDeviceFile());
  if (start) await session.open(start).catch(() => null); // gone or unreadable: the window asks for another

  const handle = (channel: string, fn: (...args: unknown[]) => unknown) =>
    answer(window, channel, fn);

  handle(CHANNEL.current, () => session.info);
  handle(CHANNEL.choose, async () => {
    const picked = await dialog.showOpenDialog(window, {
      title: 'Open a vault',
      buttonLabel: 'Open',
      properties: ['openDirectory', 'createDirectory'],
    });
    const root = picked.filePaths[0];
    if (picked.canceled || !root) return null;
    const info = await session.open(root);
    const vault = session.storage().root;
    await updateDeviceFile((data) => ({ ...data, vault }));
    return info;
  });
  handle(CHANNEL.list, () => session.storage().list());
  handle(CHANNEL.read, (path) => session.storage().read(text(path, 'path')));
  handle(CHANNEL.readBytes, (path) => session.storage().readBytes(text(path, 'path')));
  handle(CHANNEL.write, (path, body, expected) => {
    if (expected !== null && typeof expected !== 'string')
      throw new TypeError('expected must be text or null.');
    return session.storage().write(text(path, 'path'), text(body, 'text'), expected);
  });

  window.on('closed', () => session.close());
  return session;
}
