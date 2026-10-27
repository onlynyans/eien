import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../../core/config';
import type { BrowserStorage, StorageArea, StorageChange } from './browser';
import { extensionStore } from './store';

/** A browser's storage in memory, telling its listeners of each change as the browser does. */
function memoryStorage(): BrowserStorage & { areas: Record<string, Record<string, unknown>> } {
  const areas: Record<string, Record<string, unknown>> = { local: {}, sync: {} };
  const listeners: ((changes: Record<string, StorageChange>, area: string) => void)[] = [];
  const area = (name: string): StorageArea => ({
    async get(keys) {
      const wanted = typeof keys === 'string' ? [keys] : keys;
      return Object.fromEntries(
        wanted.filter((k) => k in (areas[name] ?? {})).map((k) => [k, areas[name]?.[k]]),
      );
    },
    async set(items) {
      Object.assign(areas[name] ?? {}, structuredClone(items));
      const changes = Object.fromEntries(
        Object.entries(items).map(([k, v]) => [k, { newValue: v }]),
      );
      for (const listener of listeners) listener(changes, name);
    },
  });
  return {
    areas,
    local: area('local'),
    sync: area('sync'),
    onChanged: { addListener: (listener) => listeners.push(listener) },
  };
}

describe('extensionStore: settings', () => {
  it('starts at Eien’s defaults', async () => {
    expect(await extensionStore(memoryStorage()).settings()).toEqual(DEFAULT_SETTINGS);
  });

  it('keeps a setting, synced, and tells each page of it', async () => {
    const storage = memoryStorage();
    const store = extensionStore(storage);
    const told: string[] = [];
    store.onSettings((values) => told.push(values['appearance.scheme']));
    await store.setSetting({ key: 'appearance.scheme', value: 'night' });
    expect(storage.areas.sync).toEqual({ settings: { 'appearance.scheme': 'night' } });
    expect((await store.settings())['appearance.scheme']).toBe('night');
    expect(told).toEqual(['night']);
  });

  it('leaves out what isn’t a valid setting', async () => {
    const storage = memoryStorage();
    storage.areas.sync = {
      settings: { 'appearance.face': 'comic-sans', 'appearance.textSize': 110, nope: 1 },
    };
    const values = await extensionStore(storage).settings();
    expect(values['appearance.face']).toBe(DEFAULT_SETTINGS['appearance.face']);
    expect(values['appearance.textSize']).toBe(110);
  });
});

describe('extensionStore: places and the story page open', () => {
  it('keeps where a chapter was left', async () => {
    const store = extensionStore(memoryStorage(), () => 1000);
    expect(await store.place('ao3:1/1')).toBeNull();
    await store.setPlace('ao3:1/1', 0.25);
    expect(await store.place('ao3:1/1')).toBe(0.25);
  });

  it('keeps whether the story page is open', async () => {
    const storage = memoryStorage();
    const store = extensionStore(storage);
    expect(await store.isOpen()).toBe(false);
    await store.setOpen(true);
    expect(await store.isOpen()).toBe(true);
    storage.areas.local = { open: 'yes' };
    expect(await store.isOpen()).toBe(false);
  });
});
