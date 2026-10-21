// This device's own file (spec §6): the vault last opened, and the device's
// settings. Never synced, so never in a vault. An installed copy keeps it in
// Documents/Eien, a portable or separate copy in its data folder
// (./data-folders.ts decides which).

import { mkdir, open, readFile, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { app, BrowserWindow, dialog, type MessageBoxOptions } from 'electron';
import { withoutBom } from '../../core/text';
import { writeDurably } from '../../platform/electron/disk-storage';
import { isWithin, SETTINGS_FILE, settingsFolder, thisCopy } from './data-folders';

type DeviceFile = Record<string, unknown>;

/** Absolute path of the vault last opened, if there is one. */
export const lastVault = (data: DeviceFile): string | undefined =>
  typeof data.vault === 'string' ? data.vault : undefined;

/**
 * Where the file belongs (`home`), and the data folder's file (`old`): where
 * it was before Eien kept it in Documents, and where it stays when the vault
 * holds `home`. The same file for a portable or separate copy.
 */
function places() {
  const userData = app.getPath('userData');
  return {
    home: join(settingsFolder(thisCopy(), userData, app.getPath('documents')), SETTINGS_FILE),
    old: join(userData, SETTINGS_FILE),
  };
}
type Places = ReturnType<typeof places>;

/** Where `data` is written: its home, unless the vault it names holds that (then the data folder). */
function placeFor(data: DeviceFile, { home, old }: Places): string {
  const vault = lastVault(data);
  return vault && isWithin(vault, home, process.platform) ? old : home;
}

/** A file's text, or null when there's none. A file that can't be read just now is an error. */
async function readText(file: string): Promise<string | null> {
  try {
    return await readFile(file, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

/** The contents: empty when it isn't a JSON object (there's nothing in it to keep). */
function parse(text: string): DeviceFile {
  try {
    const data: unknown = JSON.parse(withoutBom(text));
    return typeof data === 'object' && data !== null && !Array.isArray(data)
      ? (data as DeviceFile)
      : {};
  } catch {
    return {};
  }
}

/** Put `text` at `to` and remove `from`, unless `to` is already there: that one is never written over. */
async function moveOnce(from: string, text: string, to: string): Promise<boolean> {
  await mkdir(dirname(to), { recursive: true });
  let handle: Awaited<ReturnType<typeof open>>;
  try {
    handle = await open(to, 'wx');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') return false;
    throw error;
  }
  try {
    await handle.writeFile(text, 'utf8');
    await handle.sync();
  } catch (error) {
    await handle.close();
    await rm(to, { force: true }); // half a file would be taken for the newer one
    throw error;
  }
  await handle.close();
  await rm(from, { force: true });
  return true;
}

/**
 * The file's contents, and which file they came from (null: none yet). A
 * file in the data folder moves to its home once, unless its vault holds
 * that home.
 */
async function readExactly(where: Places): Promise<{ data: DeviceFile; from: string | null }> {
  if (where.old !== where.home) {
    const text = await readText(where.old);
    if (text !== null) {
      const data = parse(text);
      if (placeFor(data, where) === where.old) return { data, from: where.old };
      if (await moveOnce(where.old, text, where.home)) return { data, from: where.home };
    }
  }
  const text = await readText(where.home);
  return text === null ? { data: {}, from: null } : { data: parse(text), from: where.home };
}

/** The file's contents for reading; when it can't be read, as if empty, so the app still opens. */
export async function readDeviceFile(): Promise<DeviceFile> {
  try {
    return (await readExactly(places())).data;
  } catch (error) {
    console.warn(
      'Eien: this device’s settings couldn’t be read; using the defaults for now.',
      error,
    );
    return {};
  }
}

/** Say once, when it starts, that the vault holds the settings' home, so they're kept elsewhere. */
function tellKeptOutOfVault(vault: string, { home, old }: Places): void {
  const message: MessageBoxOptions = {
    type: 'info',
    message: 'This device’s settings stay out of your vault',
    detail: `Your vault (${vault}) holds ${dirname(home)}, where they’d go, and a vault syncs to your other devices. So Eien keeps this device’s settings in ${dirname(old)} instead.`,
  };
  // On the window, where there is one: a sheet on macOS, which waits for the writer without stopping Eien.
  const [window] = BrowserWindow.getAllWindows();
  void (window ? dialog.showMessageBox(window, message) : dialog.showMessageBox(message));
}

let queue: Promise<unknown> = Promise.resolve();

/**
 * Change the file, one change at a time, so two changes never undo each
 * other. When the file can't be read, the change is refused and the file
 * left as it is.
 */
export function updateDeviceFile(change: (data: DeviceFile) => DeviceFile): Promise<void> {
  const next = queue.then(async () => {
    const where = places();
    const { data: before, from } = await readExactly(where);
    const data = change(before);
    const to = placeFor(data, where);
    await mkdir(dirname(to), { recursive: true });
    await writeDurably(to, `${JSON.stringify(data, null, 2)}\n`);
    if (where.old === where.home) return;
    // The vault no longer holds the home: the copy kept out of it is done with.
    if (to === where.home && from === where.old) await rm(where.old, { force: true });
    const vault = lastVault(data);
    if (to === where.old && from !== where.old && vault) tellKeptOutOfVault(vault, where);
  });
  queue = next.catch(() => undefined);
  return next;
}
