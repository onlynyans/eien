// This device's own settings on the phone (spec §6: never in the vault), as
// one JSON object in Capacitor's Preferences, changed one change at a time.

import { Preferences } from '@capacitor/preferences';
import type { DeviceStore } from '../settings-store';

const KEY = 'eien.device';

/** What's kept; throws when it can't be read, so a change never writes over it. */
async function readExactly(): Promise<Record<string, unknown>> {
  const { value } = await Preferences.get({ key: KEY });
  if (value === null) return {};
  const data: unknown = JSON.parse(value);
  if (typeof data !== 'object' || data === null || Array.isArray(data))
    throw new Error('This device’s settings aren’t readable.');
  return data as Record<string, unknown>;
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
