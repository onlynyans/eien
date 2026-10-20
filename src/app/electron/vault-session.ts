// The vault a window has open, and the IPC that reaches it. Every argument
// from the window is checked here; the storage checks every path again.

import { basename } from 'node:path';
import { type BrowserWindow, dialog, type IpcMainInvokeEvent, ipcMain } from 'electron';
import { CHANNEL, type VaultInfo } from '../../platform/bridge';
import { type DiskStorage, openDiskStorage } from '../../platform/electron/disk-storage';
import { recoverStrayTemps } from '../../platform/electron/recover-temps';
import { readDeviceSettings, writeDeviceSettings } from './device-settings';

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
  const start = process.env.EIEN_VAULT || (await readDeviceSettings()).vault;
  if (start) await session.open(start).catch(() => null); // gone or unreadable: the window asks for another

  /** Only this window may ask, and only with the argument types each call takes. */
  const handle = (channel: string, fn: (...args: unknown[]) => unknown) =>
    ipcMain.handle(channel, (event: IpcMainInvokeEvent, ...args: unknown[]) => {
      if (event.sender !== window.webContents) throw new Error('Not this window.');
      return fn(...args);
    });
  const text = (value: unknown, name: string): string => {
    if (typeof value !== 'string') throw new TypeError(`${name} must be text.`);
    return value;
  };

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
    await writeDeviceSettings({ vault: session.storage().root });
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

  window.on('closed', () => {
    session.close();
    for (const channel of [
      CHANNEL.current,
      CHANNEL.choose,
      CHANNEL.list,
      CHANNEL.read,
      CHANNEL.readBytes,
      CHANNEL.write,
    ]) {
      ipcMain.removeHandler(channel);
    }
  });
  return session;
}
