// The writer's themes as Settings' Custom tab uses them: made, mixed (worn
// while a knob turns, written when it rests), renamed and trashed with the
// palette following, and a file that isn't a theme listed but never written.

import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, type SettingValues } from '../../core/config';
import { FIRST_MIX, type Mix } from '../../core/themes';
import type { SettingsBridge, VaultBridge } from '../../platform/bridge';
import { MemoryStorage } from '../../platform/memory/memory-storage';
import { SettingsState } from '../settings/settings-state';
import { WriterThemes } from './writer-themes';

const LATE: Mix = { paper: 215, warmth: 10, ink: 225, seal: 8 };

async function subject() {
  const storage = new MemoryStorage();
  let values: SettingValues = DEFAULT_SETTINGS;
  const bridge: SettingsBridge = {
    read: async () => values,
    set: async (key, value) => {
      values = { ...values, [key]: value };
      return values;
    },
  };
  const settings = await SettingsState.load(bridge);
  // What theme files need of a vault: its storage, and its changes (none come here).
  const vault = {
    listFiles: storage.listFiles.bind(storage),
    read: storage.read.bind(storage),
    write: storage.write.bind(storage),
    move: storage.move.bind(storage),
    trash: storage.trash.bind(storage),
    onChange: () => () => {},
  } as unknown as VaultBridge;
  const themes = new WriterThemes(vault, settings);
  const file = async (title: string) =>
    JSON.parse((await storage.read(`.eien/themes/${title}.json`))?.text ?? 'null');
  return { storage, settings, themes, file, palette: () => settings.values['appearance.palette'] };
}

describe('the writer’s themes', () => {
  it('makes one, numbered when the name is taken, each its own file', async () => {
    const { themes, file } = await subject();
    expect(await themes.create('Untitled', FIRST_MIX)).toMatchObject({ title: 'Untitled' });
    expect(await themes.create('untitled', FIRST_MIX)).toMatchObject({ title: 'untitled 2' });
    expect(themes.list.map((theme) => theme.title)).toEqual(['Untitled', 'untitled 2']);
    expect(await file('Untitled')).toEqual({ name: 'Untitled', mix: FIRST_MIX });
  });

  it('wears a mix while it’s chosen, and a read of the older file doesn’t take it back', async () => {
    const { themes, file } = await subject();
    await themes.create('Late Train', LATE);
    const turned = { ...LATE, warmth: 30 };
    themes.preview('Late Train', turned);
    expect(themes.list[0]?.mix).toEqual(turned);
    await themes.reload(); // another device's change, or the watcher, reads the file meanwhile
    expect(themes.list[0]?.mix).toEqual(turned);
    expect((await file('Late Train')).mix).toEqual(LATE);

    // Saved one after another, the last chosen is the one written.
    const last = { ...turned, ink: 100 };
    await Promise.all([themes.save('Late Train', turned), themes.save('Late Train', last)]);
    expect((await file('Late Train')).mix).toEqual(last);
    expect(themes.list[0]?.mix).toEqual(last);
  });

  it('renames the file, and the palette follows the theme worn', async () => {
    const { themes, settings, palette, storage } = await subject();
    await themes.create('Late Train', LATE);
    await settings.set('appearance.palette', 'mine:Late Train');
    expect(await themes.rename('Late Train', 'Night Train')).toEqual({
      ok: true,
      title: 'Night Train',
    });
    expect(palette()).toBe('mine:Night Train');
    expect(await storage.listFiles('.eien/themes')).toEqual(['Night Train.json']);

    await themes.create('Orchard', LATE);
    expect(await themes.rename('Orchard', 'night train')).toEqual({ ok: false, problem: 'taken' });
    expect(await themes.rename('Orchard', ' / ')).toEqual({ ok: false, problem: 'empty' });
  });

  it('sends one to the trash, where it can be taken back, and Paper is worn', async () => {
    const { themes, settings, palette, storage } = await subject();
    await themes.create('Late Train', LATE);
    await settings.set('appearance.palette', 'mine:Late Train');
    themes.preview('Late Train', { ...LATE, seal: 300 }); // a knob turned, not yet written
    await themes.trash('Late Train');
    expect(palette()).toBe('paper');
    expect(themes.list).toEqual([]);
    expect(storage.trashed).toEqual(['.eien/themes/Late Train.json']);
  });

  it('lists a file that isn’t a theme, with no mix, and never writes over it', async () => {
    const { themes, storage } = await subject();
    storage.put('.eien/themes/Broken.json', '{ "mix": ');
    await themes.reload();
    expect(themes.list).toMatchObject([{ title: 'Broken', mix: null }]);
    await expect(themes.save('Broken', LATE)).rejects.toThrow('isn’t valid JSON');
    expect((await storage.read('.eien/themes/Broken.json'))?.text).toBe('{ "mix": ');
  });
});
