// Settings kept where they belong (spec §6): this device's in its own store
// (a file in the app's data folder on the desktop, the phone's preferences),
// the vault's in .eien/config.json. Every value is checked against the
// schema before it's kept; a bad file is reported and never stops the app.
// The desktop's main process and the phone's window both use this.

import {
  checkSetting,
  readSettings,
  type SettingChange,
  type SettingValues,
  settingOf,
  withDefaults,
  withSetting,
} from '../core/config';
import { VAULT_CONFIG } from '../core/paths';
import { withoutBom } from '../core/text';
import type { Storage } from './storage';

/** This device's own store: a JSON object, read whole and changed one change at a time. */
export interface DeviceStore {
  read(): Promise<Record<string, unknown>>;
  /** Change it; refused (throws) when it can't be read, so nothing writes over it. */
  update(change: (data: Record<string, unknown>) => Record<string, unknown>): Promise<void>;
}

/** How many times a vault setting is tried while the file keeps changing under it. */
const WRITE_TRIES = 3;

const warn = (where: string, problems: readonly string[]) => {
  for (const problem of problems) console.warn(`Eien: ${where}: ${problem}`);
};

export class SettingsStore {
  readonly #device: DeviceStore;
  readonly #vault: () => Storage | null;

  /** Defaults of this build's own, where they differ from the schema's (a phone's, `PHONE_DEFAULTS`). */
  readonly #defaults: Partial<SettingValues>;

  /** `vault` is the open vault's storage, or null with none open. */
  constructor(
    device: DeviceStore,
    vault: () => Storage | null,
    defaults: Partial<SettingValues> = {},
  ) {
    this.#device = device;
    this.#vault = vault;
    this.#defaults = defaults;
  }

  /** The settings this device has chosen. */
  async device(): Promise<Partial<SettingValues>> {
    const { values, problems } = readSettings((await this.#device.read()).settings, 'device');
    warn('this device’s settings', problems);
    return values;
  }

  /** Every setting's value: this device's, the open vault's, and defaults for the rest. */
  async all(): Promise<SettingValues> {
    return withDefaults(await this.device(), await this.#vaultSettings(), this.#defaults);
  }

  /** Keep one setting, checked, where it belongs; every value after it. */
  async set(key: unknown, value: unknown): Promise<SettingValues> {
    const change = checkSetting(key, value);
    if (settingOf(change.key)?.scope === 'vault') await this.#setInVault(change);
    else {
      await this.#device.update((data) => ({
        ...data,
        settings: withSetting(data.settings, change),
      }));
    }
    return this.all();
  }

  /** The vault's settings file: its parsed contents and version, or null when it can't be parsed. */
  async #readVaultConfig(storage: Storage) {
    const file = await storage.read(VAULT_CONFIG);
    if (!file) return { raw: undefined, version: null };
    try {
      return { raw: JSON.parse(withoutBom(file.text)) as unknown, version: file.version };
    } catch {
      return null;
    }
  }

  async #vaultSettings(): Promise<Partial<SettingValues>> {
    const storage = this.#vault();
    if (!storage) return {};
    const config = await this.#readVaultConfig(storage);
    if (!config) {
      warn(VAULT_CONFIG, ['It isn’t valid JSON; the vault’s settings are at their defaults.']);
      return {};
    }
    const { values, problems } = readSettings(config.raw, 'vault');
    warn(VAULT_CONFIG, problems);
    return values;
  }

  async #setInVault(change: SettingChange): Promise<void> {
    const storage = this.#vault();
    if (!storage) throw new Error('Open a vault to change its settings.');
    for (let attempt = 0; attempt < WRITE_TRIES; attempt++) {
      const config = await this.#readVaultConfig(storage);
      // Never write over a file someone is part-way through editing by hand.
      if (!config)
        throw new Error(`${VAULT_CONFIG} isn’t valid JSON. Fix or remove it, then try again.`);
      const text = `${JSON.stringify(withSetting(config.raw, change), null, 2)}\n`;
      if ((await storage.write(VAULT_CONFIG, text, config.version)).ok) return;
    }
    throw new Error(`${VAULT_CONFIG} kept changing; the setting wasn’t saved.`);
  }
}
