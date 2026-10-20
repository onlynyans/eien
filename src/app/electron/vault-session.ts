// The vault a window has open, and the IPC that reaches it. Every argument
// from the window is checked here; the storage checks every path again.

import { basename } from 'node:path';
import { type BrowserWindow, dialog } from 'electron';
import { CHANNEL, type VaultInfo } from '../../platform/bridge';
import { type DiskStorage, openDiskStorage } from '../../platform/electron/disk-storage';
import { recoverStrayTemps } from '../../platform/electron/recover-temps';
import { VaultIndex } from '../../platform/index';
import { lastVault, readDeviceFile, updateDeviceFile } from './device-settings';
import { answer, text } from './ipc';

/** The longest search query the window may send. */
const MAX_QUERY_LENGTH = 1000;

export class VaultSession {
  #storage: DiskStorage | null = null;
  #index: VaultIndex | null = null;
  #stopWatching: (() => void) | null = null;
  readonly #window: BrowserWindow;

  constructor(window: BrowserWindow) {
    this.#window = window;
  }

  get info(): VaultInfo | null {
    return this.#storage ? { name: basename(this.#storage.root) } : null;
  }

  /**
   * Open the folder at `root`: recover anything a crash left, read it into
   * the index, then watch it. The window hears of a change once the index
   * holds it.
   */
  async open(root: string): Promise<VaultInfo> {
    const storage = await openDiskStorage(root);
    await recoverStrayTemps(storage);
    const index = new VaultIndex(storage);
    await index.refresh();
    this.close();
    this.#storage = storage;
    this.#index = index;
    this.#stopWatching = storage.watch((paths) => {
      void index
        .refresh(paths)
        .catch((error: unknown) => console.error('Eien: the vault couldn’t be read again:', error))
        .finally(() => {
          if (this.#index === index && !this.#window.isDestroyed()) {
            this.#window.webContents.send(CHANNEL.changed, paths);
          }
        });
    });
    return { name: basename(storage.root) };
  }

  close(): void {
    this.#stopWatching?.();
    this.#stopWatching = null;
    this.#storage = null;
    this.#index = null;
  }

  index(): VaultIndex {
    if (!this.#index) throw new Error('No vault is open.');
    return this.#index;
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
  handle(CHANNEL.list, () => session.index().entries());
  handle(CHANNEL.notes, () => session.index().notes());
  handle(CHANNEL.search, (query) => {
    const words = text(query, 'query');
    if (words.length > MAX_QUERY_LENGTH) throw new RangeError('The search is too long.');
    return session.index().search(words);
  });
  handle(CHANNEL.read, (path) => session.storage().read(text(path, 'path')));
  handle(CHANNEL.readBytes, (path) => session.storage().readBytes(text(path, 'path')));
  handle(CHANNEL.write, async (path, body, expected) => {
    if (expected !== null && typeof expected !== 'string')
      throw new TypeError('expected must be text or null.');
    const at = text(path, 'path');
    const result = await session.storage().write(at, text(body, 'text'), expected);
    // The index holds what was written before the window asks for the list again.
    if (result.ok) await session.index().refresh([at]);
    return result;
  });

  window.on('closed', () => session.close());
  return session;
}
