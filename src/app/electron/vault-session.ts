// The vault a window has open, and the IPC that reaches it. Every argument
// from the window is checked here; the storage checks every path again.

import { mkdir } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { app, type BrowserWindow, dialog, shell } from 'electron';
import { CHANNEL, type VaultInfo } from '../../platform/bridge';
import { openDiskStorage } from '../../platform/electron/disk-storage';
import { recoverStrays } from '../../platform/electron/recover-strays';
import { imageWrite } from '../../platform/image-write';
import { OpenVault } from '../../platform/open-vault';
import { DOCUMENTS_FOLDER, homeVault, thisCopy } from './data-folders';
import { lastVault, readDeviceFile, updateDeviceFile } from './device-settings';
import { answer, text, texts } from './ipc';
import { syncedBySyncthing } from './syncthing';
import { type Opened, type VaultHold, Vaults } from './vaults';

/** The longest search query the window may send. */
const MAX_QUERY_LENGTH = 1000;

/**
 * A folder, opened for the vaults the windows hold: what a crash left is
 * recovered, it's read into its index. Done once, by the first window to
 * open it (./vaults.ts).
 */
async function openFolder(root: string): Promise<Opened> {
  // The system's trash, looked up when it's used.
  const storage = await openDiskStorage(root, (path) => shell.trashItem(path));
  await recoverStrays(storage);
  const vault = await OpenVault.open(basename(storage.root), storage);
  return { vault, root: storage.root, syncthing: await syncedBySyncthing(storage.root) };
}

/** Every window's vaults: each folder opened once, however many windows show it. */
const vaults = new Vaults(openFolder);

export class VaultSession {
  #hold: VaultHold | null = null;
  readonly #window: BrowserWindow;

  constructor(window: BrowserWindow) {
    this.#window = window;
  }

  get info(): VaultInfo | null {
    return this.#hold ? { name: this.#hold.vault.name, syncthing: this.#hold.syncthing } : null;
  }

  /** The vault open now, or null. */
  get open(): OpenVault | null {
    return this.#hold?.vault ?? null;
  }

  /** Its folder on disk. */
  get root(): string | null {
    return this.#hold?.root ?? null;
  }

  /**
   * Open the folder at `root` (or share it with a window that has it open).
   * The window hears of a change once the index holds it.
   */
  async openAt(root: string): Promise<VaultInfo> {
    const hold = await vaults.hold(root, (paths, local) => {
      if (this.#hold === hold && !this.#window.isDestroyed()) {
        this.#window.webContents.send(CHANNEL.changed, paths, local);
      }
    });
    this.close();
    this.#hold = hold;
    return { name: hold.vault.name, syncthing: hold.syncthing };
  }

  close(): void {
    this.#hold?.release();
    this.#hold = null;
  }

  vault(): OpenVault {
    if (!this.#hold) throw new Error('No vault is open.');
    return this.#hold.vault;
  }

  /** `paths` were just written, moved or trashed by this window (./vaults.ts). */
  wrote(paths: readonly string[]): void {
    this.#hold?.wrote(paths);
  }

  /**
   * `paths` are being written, moved or trashed by this window: marked
   * before and after, so the other windows on this vault know the watcher's
   * echo for this window's own, whenever it comes.
   */
  async writing<T>(paths: readonly string[], write: (vault: OpenVault) => Promise<T>): Promise<T> {
    const vault = this.vault();
    this.wrote(paths);
    try {
      return await write(vault);
    } finally {
      this.wrote(paths);
    }
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
 * Answer the window's vault requests. The vault to open first is `root`,
 * the one of the window that asked for this one (New Window); else
 * EIEN_VAULT (for tests and separate copies), else the one last opened, else
 * this copy's own. When the one last opened can't be (a drive that isn't
 * connected), the window says so and asks, rather than show an empty vault in
 * its place.
 */
export async function serveVault(
  window: BrowserWindow,
  root: string | null = null,
): Promise<VaultSession> {
  const session = new VaultSession(window);
  const remembered = root ?? (process.env.EIEN_VAULT || lastVault(await readDeviceFile()));
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
  handle(CHANNEL.search, (query, within) => {
    const words = text(query, 'query');
    if (words.length > MAX_QUERY_LENGTH) throw new RangeError('The search is too long.');
    // A list's notes: the index looks each up, so a path that isn't a note finds nothing.
    return session.vault().search(words, texts(within, 'within'));
  });
  handle(CHANNEL.listFiles, (folder) => session.vault().listFiles(text(folder, 'folder')));
  handle(CHANNEL.read, (path) => session.vault().read(text(path, 'path')));
  handle(CHANNEL.readBytes, (path) => session.vault().readBytes(text(path, 'path')));
  handle(CHANNEL.write, (path, body, expected) => {
    if (expected !== null && typeof expected !== 'string')
      throw new TypeError('expected must be text or null.');
    const at = text(path, 'path');
    const words = text(body, 'text');
    return session.writing([at], (vault) => vault.write(at, words, expected));
  });
  handle(CHANNEL.writeNew, (path, bytes) => {
    const [at, image] = imageWrite(text(path, 'path'), bytes);
    return session.writing([at], (vault) => vault.writeNew(at, image));
  });
  handle(CHANNEL.move, (from, to) => {
    const [a, b] = [text(from, 'from'), text(to, 'to')];
    return session.writing([a, b], (vault) => vault.move(a, b));
  });
  handle(CHANNEL.trash, (path) => {
    const at = text(path, 'path');
    return session.writing([at], (vault) => vault.trash(at));
  });
  handle(CHANNEL.makeFolder, (path) => {
    const at = text(path, 'path');
    return session.writing([at], (vault) => vault.makeFolder(at));
  });

  window.on('closed', () => session.close());
  return session;
}
