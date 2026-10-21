import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../core/config';
import { VAULT_CONFIG } from '../core/paths';
import { MemoryStorage } from './memory/memory-storage';
import { type DeviceStore, SettingsStore } from './settings-store';

/** A device store in memory: what it holds, and refusals when it can't be read. */
function device(start: Record<string, unknown> = {}) {
  let data = start;
  let readable = true;
  const store: DeviceStore = {
    read: async () => data,
    update: async (change) => {
      if (!readable) throw new Error('unreadable');
      data = change(data);
    },
  };
  return { store, data: () => data, refuse: () => (readable = false) };
}

describe('SettingsStore', () => {
  it('keeps a device setting on the device, and a vault setting in the vault', async () => {
    const vault = new MemoryStorage();
    const mine = device();
    const settings = new SettingsStore(mine.store, () => vault);
    await settings.set('appearance.face', 'literata');
    await settings.set('books.numerals', 'arabic');
    expect(mine.data()).toEqual({ settings: { 'appearance.face': 'literata' } });
    expect(JSON.parse((await vault.read(VAULT_CONFIG))?.text ?? '')).toEqual({
      'books.numerals': 'arabic',
    });
    expect(await settings.all()).toEqual({
      ...DEFAULT_SETTINGS,
      'appearance.face': 'literata',
      'books.numerals': 'arabic',
    });
  });

  it('refuses a bad value, a vault setting with no vault, and a vault file it can’t read', async () => {
    const vault = new MemoryStorage();
    const settings = new SettingsStore(device().store, () => vault);
    await expect(settings.set('appearance.face', 'comic-sans')).rejects.toThrow(/must be one of/);
    await expect(
      new SettingsStore(device().store, () => null).set('books.numerals', 'arabic'),
    ).rejects.toThrow(/Open a vault/);
    vault.put(VAULT_CONFIG, '{ "half": ');
    await expect(settings.set('books.numerals', 'arabic')).rejects.toThrow(/isn’t valid JSON/);
    expect((await vault.read(VAULT_CONFIG))?.text).toBe('{ "half": '); // never written over
  });

  it('reads a bad file as defaults, with a warning, and never stops', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const vault = new MemoryStorage();
    vault.put(VAULT_CONFIG, 'not json');
    const settings = new SettingsStore(
      device({ settings: { 'appearance.face': 'nope' } }).store,
      () => vault,
    );
    expect(await settings.all()).toEqual(DEFAULT_SETTINGS);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
