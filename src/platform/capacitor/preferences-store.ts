// This device's own settings on the phone (spec §6: never in the vault), as
// one JSON object in Capacitor's Preferences, changed one change at a time.

import { Preferences } from '@capacitor/preferences';
import type { DeviceStore } from '../settings-store';

const KEY = 'eien.device';

async function readExactly(): Promise<Record<string, unknown>> {
  const { value } = await Preferences.get({ key: KEY });
  if (value === null) return {};
  try {
    const data: unknown = JSON.parse(value);
    return typeof data === 'object' && data !== null && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

let queue: Promise<unknown> = Promise.resolve();

export const preferencesStore: DeviceStore = {
  read: () => readExactly().catch(() => ({})),
  update(change) {
    const next = queue.then(async () => {
      const data = change(await readExactly());
      await Preferences.set({ key: KEY, value: JSON.stringify(data) });
    });
    queue = next.catch(() => undefined);
    return next;
  },
};
