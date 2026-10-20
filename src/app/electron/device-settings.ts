// This device's own settings, in the app's data folder, never in a vault
// (spec §6). Phase 3 keeps one: the vault last opened.

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { app } from 'electron';
import { writeDurably } from '../../platform/electron/disk-storage';

export interface DeviceSettings {
  /** Absolute path of the vault last opened. */
  readonly vault?: string;
}

const file = () => join(app.getPath('userData'), 'settings.json');

/** The settings, or none when the file is missing or unreadable. */
export async function readDeviceSettings(): Promise<DeviceSettings> {
  try {
    const data: unknown = JSON.parse(await readFile(file(), 'utf8'));
    if (typeof data !== 'object' || data === null) return {};
    const { vault } = data as Record<string, unknown>;
    return typeof vault === 'string' ? { vault } : {};
  } catch {
    return {};
  }
}

export async function writeDeviceSettings(settings: DeviceSettings): Promise<void> {
  await writeDurably(file(), `${JSON.stringify(settings, null, 2)}\n`);
}
