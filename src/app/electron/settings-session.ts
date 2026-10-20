// Settings for the window (spec §6): this device's from its own file, the
// vault's from .eien/config.json, through the shared SettingsStore
// (platform/settings-store.ts). The scheme and the menu's checks follow them.

import { type BrowserWindow, nativeTheme } from 'electron';
import { type SettingValues, withDefaults } from '../../core/config';
import { CHANNEL } from '../../platform/bridge';
import { type DeviceStore, SettingsStore } from '../../platform/settings-store';
import { readDeviceFile, updateDeviceFile } from './device-settings';
import { answer } from './ipc';
import { checkToggles } from './menu';
import type { VaultSession } from './vault-session';

const THEME_SOURCE = { system: 'system', day: 'light', night: 'dark' } as const;

/** Day, night or the system's, for the whole app: the window's colours and frame follow it. */
export function applyScheme(values: SettingValues): void {
  nativeTheme.themeSource = THEME_SOURCE[values['appearance.scheme']];
}

/** This device's file in the app's data folder (./device-settings.ts). */
const deviceFile: DeviceStore = { read: readDeviceFile, update: updateDeviceFile };

/** The settings this device has chosen, with no vault open (at launch). */
export async function deviceSettings(): Promise<SettingValues> {
  return withDefaults(await new SettingsStore(deviceFile, () => null).device());
}

/** Answer the window's settings requests. */
export function serveSettings(window: BrowserWindow, vault: VaultSession): void {
  const store = new SettingsStore(deviceFile, () => vault.open?.storage ?? null);
  answer(window, CHANNEL.settingsRead, () => store.all());
  answer(window, CHANNEL.settingsSet, async (key, value) => {
    const values = await store.set(key, value);
    applyScheme(values);
    checkToggles(values);
    return values;
  });
}
