// Wearing a theme, and the writer's own themes as the window keeps them,
// without a window: over the in-memory vault and a settings bridge.

import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, type SettingValues } from '../../core/config';
import {
  FIRST_MIX,
  galleryTheme,
  type Mix,
  mixPalette,
  THEME_TOKENS,
  themeTokens,
} from '../../core/themes';
import type { SettingsBridge, VaultBridge } from '../../platform/bridge';
import { MemoryStorage } from '../../platform/memory/memory-storage';
import type { WriterTheme } from '../../platform/theme-files';
import { SettingsState } from '../settings/settings-state';
import { wear, wornFor } from './wear';
import { WriterThemes } from './writer-themes';

const LATE: Mix = { paper: 215, warmth: 10, ink: 225, seal: 8 };
const late: WriterTheme = {
  title: 'Late Train',
  path: '.eien/themes/Late Train.json',
  mix: LATE,
  problems: [],
};

/** Enough of <html> to wear a theme on: its data attributes and custom properties. */
function fakeRoot() {
  const properties = new Map<string, string>();
  const root = {
    dataset: {} as Record<string, string>,
    style: {
      setProperty: (name: string, value: string) => void properties.set(name, value),
      removeProperty: (name: string) => void properties.delete(name),
    },
  };
  return { root: root as unknown as HTMLElement, dataset: root.dataset, properties };
}

describe('wornFor', () => {
  it('wears Washi as tokens.css has it, and Otaku by its sheet', () => {
    expect(wornFor('washi', [])).toEqual({ attribute: undefined, palette: null });
    expect(wornFor('otaku', [])).toEqual({ attribute: 'otaku', palette: null });
  });

  it('wears the gallery’s other themes as their colours', () => {
    expect(wornFor('kinari', [])).toEqual({
      attribute: 'kinari',
      palette: galleryTheme('kinari')?.palette,
    });
  });

  it('wears the writer’s own by its name, as the storage compares names', () => {
    const worn = { attribute: 'mine', palette: mixPalette(LATE) };
    expect(wornFor('mine:Late Train', [late])).toEqual(worn);
    expect(wornFor('mine:LATE TRAIN', [late])).toEqual(worn);
  });

  it('wears Washi for a theme that isn’t there, or can’t be read', () => {
    const washi = { attribute: undefined, palette: null };
    expect(wornFor('mine:Late Train', [])).toEqual(washi);
    expect(wornFor('mine:Late Train', [{ ...late, mix: null }])).toEqual(washi);
    expect(wornFor('nothing', [late])).toEqual(washi);
  });
});

describe('wear', () => {
  it('sets data-palette and the theme’s colour tokens on <html>', () => {
    const { root, dataset, properties } = fakeRoot();
    wear(wornFor('mine:Late Train', [late]), root);
    expect(dataset.palette).toBe('mine');
    expect(Object.fromEntries(properties)).toEqual(themeTokens(mixPalette(LATE)));
  });

  it('takes the theme before off whole, and leaves every other property', () => {
    const { root, dataset, properties } = fakeRoot();
    root.style.setProperty('--eien-text-scale', '1.2');
    wear(wornFor('kinari', []), root);
    wear(wornFor('otaku', []), root);
    expect(dataset.palette).toBe('otaku');
    for (const token of THEME_TOKENS) expect(properties.has(token), token).toBe(false);
    wear(wornFor('washi', []), root);
    expect(dataset).toEqual({});
    expect(Object.fromEntries(properties)).toEqual({ '--eien-text-scale': '1.2' });
  });
});

/** The in-memory vault as the window's bridge to it, and settings kept in memory. */
async function opened() {
  const storage = new MemoryStorage();
  const listeners = new Set<(paths: string[]) => void>();
  storage.watch((paths) => {
    for (const listener of listeners) listener(paths);
  });
  const vault = {
    listFiles: (folder: string) => storage.listFiles(folder),
    read: (path: string) => storage.read(path),
    write: (path: string, text: string, expected: string | null) =>
      storage.write(path, text, expected),
    move: (from: string, to: string) => storage.move(from, to),
    trash: (path: string) => storage.trash(path),
    onChange: (listener: (paths: string[]) => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  } as unknown as VaultBridge;
  let values: SettingValues = DEFAULT_SETTINGS;
  const bridge: SettingsBridge = {
    read: async () => values,
    set: async (key, value) => {
      values = { ...values, [key]: value };
      return values;
    },
  };
  const settings = await SettingsState.load(bridge);
  const themes = new WriterThemes(vault, settings);
  return { storage, settings, themes };
}

const titles = (themes: WriterThemes) => themes.list.map((theme) => theme.title);

describe('WriterThemes', () => {
  it('lists the vault’s themes once read, and none before', async () => {
    const { storage, themes } = await opened();
    storage.put('.eien/themes/Orchard.json', JSON.stringify({ mix: FIRST_MIX }));
    expect(themes.list).toEqual([]);
    await themes.reload();
    expect(titles(themes)).toEqual(['Orchard']);
  });

  it('shows a theme another device changed, made or trashed', async () => {
    const { storage, themes } = await opened();
    const heard = vi.fn();
    themes.onChange(heard);
    storage.put('.eien/themes/Orchard.json', JSON.stringify({ mix: LATE }));
    await vi.waitFor(() => expect(titles(themes)).toEqual(['Orchard']));
    storage.put('.eien/themes/Orchard.json', JSON.stringify({ mix: FIRST_MIX }));
    await vi.waitFor(() => expect(themes.list[0]?.mix).toEqual(FIRST_MIX));
    expect(heard).toHaveBeenCalled();
  });

  it('wears a saved mix at once, and writes it', async () => {
    const { storage, themes } = await opened();
    await themes.create('Late Train', LATE);
    const saving = themes.save('Late Train', FIRST_MIX);
    expect(themes.list[0]?.mix).toEqual(FIRST_MIX); // before the write is done
    await saving;
    const file = JSON.parse((await storage.read('.eien/themes/Late Train.json'))?.text ?? '');
    expect(file.mix).toEqual(FIRST_MIX);
  });

  it('keeps wearing a theme it renames: the palette setting follows the file', async () => {
    const { settings, themes } = await opened();
    await themes.create('Late Train', LATE);
    await settings.set('appearance.palette', 'mine:Late Train');
    expect(await themes.rename('Late Train', 'Night Train')).toEqual({
      ok: true,
      title: 'Night Train',
    });
    expect(settings.values['appearance.palette']).toBe('mine:Night Train');
    expect(titles(themes)).toEqual(['Night Train']);
  });

  it('leaves the setting alone when the theme renamed isn’t the one worn', async () => {
    const { settings, themes } = await opened();
    await themes.create('Late Train', LATE);
    await settings.set('appearance.palette', 'kinari');
    await themes.rename('Late Train', 'Night Train');
    expect(settings.values['appearance.palette']).toBe('kinari');
  });

  it('sends a theme to the trash, and wears Washi when it was the one worn', async () => {
    const { storage, settings, themes } = await opened();
    await themes.create('Late Train', LATE);
    await settings.set('appearance.palette', 'mine:late train');
    await themes.trash('Late Train');
    expect(storage.trashed).toEqual(['.eien/themes/Late Train.json']);
    expect(titles(themes)).toEqual([]);
    expect(settings.values['appearance.palette']).toBe('washi');
  });

  it('mixes and judges for the Themes tabs', async () => {
    const { themes } = await opened();
    expect(themes.palette(LATE)).toEqual(mixPalette(LATE));
    expect(themes.verdict(LATE).keeps).toBe(true);
  });
});
