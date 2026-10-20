// Settings for the window (spec §6): this device's from its own file, the
// vault's from .eien/config.json. Every value is checked against the schema
// before it's kept. A bad file is reported in the log and never stops the
// app; its settings fall back to their defaults.

import { type BrowserWindow, nativeTheme } from 'electron';
import {
  checkSetting,
  readSettings,
  type SettingChange,
  type SettingValues,
  settingOf,
  withDefaults,
  withSetting,
} from '../../core/config';
import { VAULT_CONFIG } from '../../core/paths';
import { withoutBom } from '../../core/text';
import { CHANNEL } from '../../platform/bridge';
import { readDeviceFile, updateDeviceFile } from './device-settings';
import { answer } from './ipc';
import type { VaultSession } from './vault-session';

const THEME_SOURCE = { system: 'system', day: 'light', night: 'dark' } as const;

/** Day, night or the system's, for the whole app: the window's colours and frame follow it. */
export function applyScheme(values: SettingValues): void {
  nativeTheme.themeSource = THEME_SOURCE[values['appearance.scheme']];
}

const warn = (where: string, problems: readonly string[]) => {
  for (const problem of problems) console.warn(`Eien: ${where}: ${problem}`);
};

/** The settings this device has chosen. */
export async function deviceSettings(): Promise<Partial<SettingValues>> {
  const { values, problems } = readSettings((await readDeviceFile()).settings, 'device');
  warn('settings.json', problems);
  return values;
}

/** The vault's settings file: its parsed contents and version, or null when it can't be parsed. */
async function readVaultConfig(vault: VaultSession) {
  const file = await vault.storage().read(VAULT_CONFIG);
  if (!file) return { raw: undefined, version: null };
  try {
    return { raw: JSON.parse(withoutBom(file.text)) as unknown, version: file.version };
  } catch {
    return null;
  }
}

async function vaultSettings(vault: VaultSession): Promise<Partial<SettingValues>> {
  if (!vault.info) return {};
  const config = await readVaultConfig(vault);
  if (!config) {
    warn(VAULT_CONFIG, ['It isn’t valid JSON; the vault’s settings are at their defaults.']);
    return {};
  }
  const { values, problems } = readSettings(config.raw, 'vault');
  warn(VAULT_CONFIG, problems);
  return values;
}

/** How many times a vault setting is tried while the file keeps changing under it. */
const WRITE_TRIES = 3;

async function setInVault(vault: VaultSession, change: SettingChange): Promise<void> {
  if (!vault.info) throw new Error('Open a vault to change its settings.');
  for (let attempt = 0; attempt < WRITE_TRIES; attempt++) {
    const config = await readVaultConfig(vault);
    // Never write over a file someone is part-way through editing by hand.
    if (!config)
      throw new Error(`${VAULT_CONFIG} isn’t valid JSON. Fix or remove it, then try again.`);
    const text = `${JSON.stringify(withSetting(config.raw, change), null, 2)}\n`;
    if ((await vault.storage().write(VAULT_CONFIG, text, config.version)).ok) return;
  }
  throw new Error(`${VAULT_CONFIG} kept changing; the setting wasn’t saved.`);
}

/** Every setting's value: this device's, the open vault's, and defaults for the rest. */
export async function allSettings(vault: VaultSession): Promise<SettingValues> {
  return withDefaults(await deviceSettings(), await vaultSettings(vault));
}

/** Answer the window's settings requests. */
export function serveSettings(window: BrowserWindow, vault: VaultSession): void {
  answer(window, CHANNEL.settingsRead, () => allSettings(vault));
  answer(window, CHANNEL.settingsSet, async (key, value) => {
    const change = checkSetting(key, value);
    if (settingOf(change.key)?.scope === 'vault') await setInVault(vault, change);
    else {
      await updateDeviceFile((data) => ({ ...data, settings: withSetting(data.settings, change) }));
    }
    const values = await allSettings(vault);
    applyScheme(values);
    return values;
  });
}
