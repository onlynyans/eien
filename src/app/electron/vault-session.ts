// The vault a window has open, and the IPC that reaches it. Every argument
// from the window is checked here; the storage checks every path again.

import { mkdir } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { app, type BrowserWindow, dialog, shell } from 'electron';
import { CHANNEL, type VaultInfo } from '../../platform/bridge';
import { openDiskStorage } from '../../platform/electron/disk-storage';
import { recoverStrays } from '../../platform/electron/recover-strays';
import { OpenVault } from '../../platform/open-vault';
import { DOCUMENTS_FOLDER, homeVault, thisCopy } from './data-folders';
import { lastVault, readDeviceFile, updateDeviceFile } from './device-settings';
import { answer, text } from './ipc';

/** The longest search query the window may send. */
const MAX_QUERY_LENGTH = 1000;

export class VaultSession {
  #open: OpenVault | null = null;
  #root: string | null = null;
  #stopWatching: (() => void) | null = null;
  readonly #window: BrowserWindow;

  constructor(window: BrowserWindow) {
    this.#window = window;
  }

  get info(): VaultInfo | null {
    return this.#open ? { name: this.#open.name } : null;
  }

  /** The vault open now, or null. */
  get open(): OpenVault | null {
    return this.#open;
  }

  /** Its folder on disk. */
  get root(): string | null {
    return this.#root;
  }

  /**
   * Open the folder at `root`: recover anything a crash left, read it into
   * the index, then watch it. The window hears of a change once the index
   * holds it.
   */
  async openAt(root: string): Promise<VaultInfo> {
    // The system's trash, looked up when it's used.
    const storage = await openDiskStorage(root, (path) => shell.trashItem(path));
    await recoverStrays(storage);
    const vault = await OpenVault.open(basename(storage.root), storage);
    this.close();
    this.#open = vault;
    this.#root = storage.root;
    this.#stopWatching = vault.watch((paths) => {
      if (this.#open === vault && !this.#window.isDestroyed()) {
        this.#window.webContents.send(CHANNEL.changed, paths);
      }
    });
    return { name: vault.name };
  }

  close(): void {
    this.#stopWatching?.();
    this.#stopWatching = null;
    this.#open = null;
    this.#root = null;
  }

  vault(): OpenVault {
    if (!this.#open) throw new Error('No vault is open.');
    return this.#open;
  }
}

/** This copy's own vault (./data-folders.ts), made if need be; when it can't be, the window asks for a folder. */
async function openHome(session: VaultSession): Promise<void> {
  const home = homeVault(thisCopy(), app.getPath('documents'));
  try {
    await mkdir(home, { recursive: true }); // what's already there stays as it is
    await session.openAt(home);
  } catch (error) {
    console.warn(`Eien: ${home} couldn’t be opened; the window asks for a folder.`, error);
  }
}

/**
 * Answer the window's vault requests. The vault to open first is
 * EIEN_VAULT (for tests and separate copies), else the one last opened, else
 * this copy's own. When the one last opened can't be (a drive that isn't
 * connected), the window says so and asks, rather than show an empty vault in
 * its place.
 */
export async function serveVault(window: BrowserWindow): Promise<VaultSession> {
  const session = new VaultSession(window);
  const remembered = process.env.EIEN_VAULT || lastVault(await readDeviceFile());
  if (remembered) await session.openAt(remembered).catch(() => null);
  else await openHome(session);

  const handle = (channel: string, fn: (...args: unknown[]) => unknown) =>
    answer(window, channel, fn);

  handle(CHANNEL.current, () => session.info);
  handle(CHANNEL.choose, async () => {
    const picked = await dialog.showOpenDialog(window, {
      title: 'Open a vault',
      buttonLabel: 'Open',
      // Beside the vault Eien starts in, Documents/Eien/Vault: the same layout on every device.
      defaultPath: join(app.getPath('documents'), DOCUMENTS_FOLDER),
      properties: ['openDirectory', 'createDirectory'],
    });
    const root = picked.filePaths[0];
    if (picked.canceled || !root) return null;
    const info = await session.openAt(root);
    const vault = session.root;
    await updateDeviceFile((data) => ({ ...data, vault }));
    return info;
  });
  handle(CHANNEL.list, () => session.vault().list());
  handle(CHANNEL.notes, () => session.vault().notes());
  handle(CHANNEL.search, (query) => {
    const words = text(query, 'query');
    if (words.length > MAX_QUERY_LENGTH) throw new RangeError('The search is too long.');
    return session.vault().search(words);
  });
  handle(CHANNEL.listFiles, (folder) => session.vault().listFiles(text(folder, 'folder')));
  handle(CHANNEL.read, (path) => session.vault().read(text(path, 'path')));
  handle(CHANNEL.readBytes, (path) => session.vault().readBytes(text(path, 'path')));
  handle(CHANNEL.write, (path, body, expected) => {
    if (expected !== null && typeof expected !== 'string')
      throw new TypeError('expected must be text or null.');
    return session.vault().write(text(path, 'path'), text(body, 'text'), expected);
  });
  handle(CHANNEL.move, (from, to) => session.vault().move(text(from, 'from'), text(to, 'to')));
  handle(CHANNEL.trash, (path) => session.vault().trash(text(path, 'path')));
  handle(CHANNEL.makeFolder, (path) => session.vault().makeFolder(text(path, 'path')));

  window.on('closed', () => session.close());
  return session;
}
