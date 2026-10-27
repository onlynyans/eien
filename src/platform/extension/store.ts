// What the extension keeps (spec §14), in the browser's own storage: Eien's
// settings, the ones the extension offers, synced with the browser's account;
// and on this browser, where each chapter was left and whether the story page is
// open. Every value is checked as it's read, as another version of the
// extension, or the page's own script, may have written anything.

import {
  type SettingChange,
  type SettingValues,
  settingOf,
  valueProblem,
  withDefaults,
  withSetting,
} from '../../core/config';
import { type Places, placesOf, withPlace } from '../../core/extension';
import type { BrowserStorage } from './browser';

const SETTINGS = 'settings';
const PLACES = 'places';
const OPEN = 'open';

/** The settings in `raw` that are Eien's and valid; the rest are left out, and their defaults stand. */
function knownSettings(raw: unknown): Partial<SettingValues> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};
  return Object.fromEntries(
    Object.entries(raw).filter(([key, value]) => {
      const setting = settingOf(key);
      return setting !== undefined && valueProblem(setting, value) === null;
    }),
  ) as Partial<SettingValues>;
}

export interface ExtensionStore {
  settings(): Promise<SettingValues>;
  setSetting(change: SettingChange): Promise<void>;
  /** Each change to the settings, from any of the extension's pages or another device. */
  onSettings(listener: (values: SettingValues) => void): void;
  /** How far down the page `key` was left, or null when it hasn't been read here. */
  place(key: string): Promise<number | null>;
  setPlace(key: string, at: number): Promise<void>;
  /** Whether a story opens on the story page, as it last did. */
  isOpen(): Promise<boolean>;
  setOpen(open: boolean): Promise<void>;
}

export function extensionStore(
  storage: BrowserStorage,
  now: () => number = Date.now,
): ExtensionStore {
  const places = async (): Promise<Places> => placesOf((await storage.local.get(PLACES))[PLACES]);
  return {
    async settings() {
      return withDefaults(knownSettings((await storage.sync.get(SETTINGS))[SETTINGS]));
    },
    async setSetting(change) {
      const raw = (await storage.sync.get(SETTINGS))[SETTINGS];
      await storage.sync.set({ [SETTINGS]: withSetting(raw, change) });
    },
    onSettings(listener) {
      storage.onChanged.addListener((changes, area) => {
        const change = changes[SETTINGS];
        if (area === 'sync' && change) listener(withDefaults(knownSettings(change.newValue)));
      });
    },
    async place(key) {
      return (await places())[key]?.at ?? null;
    },
    async setPlace(key, at) {
      await storage.local.set({ [PLACES]: withPlace(await places(), key, at, now()) });
    },
    async isOpen() {
      return (await storage.local.get(OPEN))[OPEN] === true;
    },
    async setOpen(open) {
      await storage.local.set({ [OPEN]: open });
    },
  };
}
