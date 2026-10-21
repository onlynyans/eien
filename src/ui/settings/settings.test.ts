// The window's side of settings, without a window: what the look sets on
// <html>, and how changes are shown, kept, refused and ordered.

import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, type SettingKey, type SettingValues } from '../../core/config';
import type { SettingsBridge } from '../../platform/bridge';
import { reasonOf } from '../reason';
import { applyLook } from './look';
import { SettingsState } from './settings-state';

/** Enough of <html> for applyLook: its data attributes and custom properties. */
function fakeRoot() {
  const properties = new Map<string, string>();
  const root = {
    dataset: {} as Record<string, string>,
    style: { setProperty: (name: string, value: string) => void properties.set(name, value) },
  };
  return { root: root as unknown as HTMLElement, dataset: root.dataset, properties };
}

describe('applyLook', () => {
  it('sets nothing but the scales at the defaults', () => {
    const { root, dataset, properties } = fakeRoot();
    applyLook(DEFAULT_SETTINGS, root);
    expect(dataset).toEqual({});
    expect(Object.fromEntries(properties)).toEqual({
      '--eien-text-scale': '1',
      '--eien-zoom': '1',
    });
  });

  it('turns each choice into the attribute the tokens follow', () => {
    const { root, dataset, properties } = fakeRoot();
    applyLook(
      {
        ...DEFAULT_SETTINGS,
        'appearance.scheme': 'night',
        'appearance.face': 'atkinson',
        'appearance.density': 'compact',
        'appearance.frame': 'full',
        'appearance.textSize': 120,
        'page.zoom': 150,
      },
      root,
    );
    expect(dataset).toEqual({
      theme: 'dark',
      face: 'atkinson',
      density: 'compact',
      frame: 'full',
    });
    expect(properties.get('--eien-text-scale')).toBe('1.2');
    expect(properties.get('--eien-zoom')).toBe('1.5');
  });

  it('takes an attribute away when its setting goes back to the default', () => {
    const { root, dataset } = fakeRoot();
    applyLook(
      { ...DEFAULT_SETTINGS, 'appearance.scheme': 'day', 'appearance.face': 'hanken' },
      root,
    );
    expect(dataset).toEqual({ theme: 'light', face: 'hanken' });
    applyLook(DEFAULT_SETTINGS, root);
    expect(dataset).toEqual({});
  });
});

/** A bridge whose answers the test releases one at a time. */
function slowBridge() {
  const kept: {
    key: SettingKey;
    value: unknown;
    answer: (values: SettingValues) => void;
    fail: (e: Error) => void;
  }[] = [];
  let disk: SettingValues = DEFAULT_SETTINGS;
  const bridge: SettingsBridge = {
    read: vi.fn(async () => disk),
    set: (key, value) =>
      new Promise((answer, fail) => {
        kept.push({ key, value, answer, fail });
      }),
  };
  return {
    bridge,
    kept,
    setDisk: (values: SettingValues) => {
      disk = values;
    },
  };
}

describe('SettingsState', () => {
  it('shows a change at once, and tells its listeners what came before', async () => {
    const { bridge, kept } = slowBridge();
    const settings = await SettingsState.load(bridge);
    const heard: [number, number][] = [];
    settings.onChange((values, before) => heard.push([values['page.zoom'], before['page.zoom']]));
    const done = settings.set('page.zoom', 110);
    expect(settings.values['page.zoom']).toBe(110); // before the main process answers
    kept[0]?.answer({ ...DEFAULT_SETTINGS, 'page.zoom': 110 });
    await done;
    expect(heard).toEqual([
      [110, 100],
      [110, 110],
    ]);
  });

  it('keeps the latest change when answers come back late', async () => {
    const { bridge, kept } = slowBridge();
    const settings = await SettingsState.load(bridge);
    const first = settings.set('page.zoom', 110);
    const second = settings.set('page.zoom', 120);
    kept[1]?.answer({ ...DEFAULT_SETTINGS, 'page.zoom': 120 });
    await second;
    kept[0]?.answer({ ...DEFAULT_SETTINGS, 'page.zoom': 110 }); // the older answer, last
    await first;
    expect(settings.values['page.zoom']).toBe(120);
  });

  it('shows what is kept, and passes the reason on, when a change is refused', async () => {
    const { bridge, kept, setDisk } = slowBridge();
    const settings = await SettingsState.load(bridge);
    setDisk({ ...DEFAULT_SETTINGS, 'books.numerals': 'roman' });
    const done = settings.set('books.numerals', 'arabic');
    expect(settings.values['books.numerals']).toBe('arabic');
    kept[0]?.fail(new Error('.eien/config.json isn’t valid JSON.'));
    await expect(done).rejects.toThrow(/valid JSON/);
    expect(settings.values['books.numerals']).toBe('roman');
  });

  it('stops telling a listener once it has stopped listening', async () => {
    const { bridge } = slowBridge();
    const settings = await SettingsState.load(bridge);
    const listener = vi.fn();
    const stop = settings.onChange(listener);
    stop();
    await settings.reload();
    expect(listener).not.toHaveBeenCalled();
  });
});

describe('reasonOf', () => {
  it('drops Electron’s wrapping from a refusal', () => {
    const wrapped = new Error(
      "Error invoking remote method 'settings:set': TypeError: appearance.face must be one of newsreader, literata",
    );
    expect(reasonOf(wrapped)).toBe('appearance.face must be one of newsreader, literata');
    expect(
      reasonOf(
        new Error("Error invoking remote method 'settings:set': Error: Open a vault first."),
      ),
    ).toBe('Open a vault first.');
    expect(reasonOf(new Error('Plain.'))).toBe('Plain.');
    expect(reasonOf('text')).toBe('text');
  });
});
