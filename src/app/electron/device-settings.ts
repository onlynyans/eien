// This device's own file, in the app's data folder and never in a vault
// (spec §6): the vault last opened, and the device's settings.

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { app } from 'electron';
import { withoutBom } from '../../core/text';
import { writeDurably } from '../../platform/electron/disk-storage';

type DeviceFile = Record<string, unknown>;

const file = () => join(app.getPath('userData'), 'settings.json');

/**
 * The file's contents: empty when there's no file, or it isn't a JSON
 * object (there's nothing in it to keep). A file that's there but can't be
 * read just now — locked, or not permitted — is an error, so that nothing
 * writes over it.
 */
async function readExactly(): Promise<DeviceFile> {
  let text: string;
  try {
    text = await readFile(file(), 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {};
    throw error;
  }
  try {
    const data: unknown = JSON.parse(withoutBom(text));
    return typeof data === 'object' && data !== null && !Array.isArray(data)
      ? (data as DeviceFile)
      : {};
  } catch {
    return {};
  }
}

/** The file's contents for reading; when it can't be read, as if empty, so the app still opens. */
export async function readDeviceFile(): Promise<DeviceFile> {
  try {
    return await readExactly();
  } catch (error) {
    console.warn(
      'Eien: this device’s settings couldn’t be read; using the defaults for now.',
      error,
    );
    return {};
  }
}

/** Absolute path of the vault last opened, if there is one. */
export const lastVault = (data: DeviceFile): string | undefined =>
  typeof data.vault === 'string' ? data.vault : undefined;

let queue: Promise<unknown> = Promise.resolve();

/**
 * Change the file, one change at a time, so two changes never undo each
 * other. When the file can't be read, the change is refused and the file
 * left as it is.
 */
export function updateDeviceFile(change: (data: DeviceFile) => DeviceFile): Promise<void> {
  const next = queue.then(async () => {
    const data = change(await readExactly());
    await writeDurably(file(), `${JSON.stringify(data, null, 2)}\n`);
  });
  queue = next.catch(() => undefined);
  return next;
}
