// This device's own file, in the app's data folder and never in a vault
// (spec §6): the vault last opened, and the device's settings.

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { app } from 'electron';
import { writeDurably } from '../../platform/electron/disk-storage';

type DeviceFile = Record<string, unknown>;

const file = () => join(app.getPath('userData'), 'settings.json');

/** The file's contents; empty when it's missing or isn't a JSON object. */
export async function readDeviceFile(): Promise<DeviceFile> {
  try {
    const data: unknown = JSON.parse(await readFile(file(), 'utf8'));
    return typeof data === 'object' && data !== null && !Array.isArray(data)
      ? (data as DeviceFile)
      : {};
  } catch {
    return {};
  }
}

/** Absolute path of the vault last opened, if there is one. */
export const lastVault = (data: DeviceFile): string | undefined =>
  typeof data.vault === 'string' ? data.vault : undefined;

let queue: Promise<unknown> = Promise.resolve();

/** Change the file, one change at a time, so two changes never undo each other. */
export function updateDeviceFile(change: (data: DeviceFile) => DeviceFile): Promise<void> {
  const next = queue.then(async () => {
    const data = change(await readDeviceFile());
    await writeDurably(file(), `${JSON.stringify(data, null, 2)}\n`);
  });
  queue = next.catch(() => undefined);
  return next;
}
