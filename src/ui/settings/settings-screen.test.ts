// Settings offers what the window has room for, as it changes (spec §6, §10):
// with one pane, the phone's way, no panes to choose; with the desktop's panes
// on a wider phone, the same settings as the desktop's.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, type SettingValues } from '../../core/config';
import type { SettingsBridge, VaultBridge } from '../../platform/bridge';
import { pageOf } from '../page/test-page-room';
import { WriterThemes } from '../theme/writer-themes';
import { SettingsScreen } from './settings-screen';
import { SettingsState } from './settings-state';

let settings: SettingsState;

async function screenOn(platform: string): Promise<SettingsScreen> {
  let values: SettingValues = DEFAULT_SETTINGS;
  const bridge: SettingsBridge = {
    read: async () => values,
    set: async (key, value) => {
      values = { ...values, [key]: value };
      return values;
    },
  };
  settings = await SettingsState.load(bridge);
  const vault = { onChange: () => () => {} } as unknown as VaultBridge;
  return new SettingsScreen(document.body, settings, platform, new WriterThemes(vault, settings));
}

const tab = (name: string) =>
  [...document.querySelectorAll<HTMLButtonElement>('.settings__tab')].find(
    (button) => button.textContent === name,
  );
const row = (key: string) => document.querySelector<HTMLElement>(`[data-setting="${key}"]`);

beforeEach(() => {
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.open = true;
  };
});
afterEach(() => document.body.replaceChildren());

describe('Wide screen, on a phone wider than 600px', () => {
  it('is offered in Appearance, and on the desktop not at all', async () => {
    await screenOn('android');
    expect(row('appearance.room')).not.toBeNull();
    document.body.replaceChildren();
    await screenOn('darwin');
    expect(row('appearance.room')).toBeNull();
  });

  it('shows the panes’ settings with the desktop’s panes, and hides them, live, one pane at a time', async () => {
    await screenOn('android');
    expect(tab('Lists')?.hidden).toBe(false);
    expect(row('layout.panes')?.hidden).toBe(false);
    expect(row('appearance.shutSidebar')?.hidden).toBe(false);
    for (const room of ['one', 'side', 'pages'] as const) {
      await settings.set('appearance.room', room);
      expect(tab('Lists')?.hidden, room).toBe(true); // nothing in it the phone's way
      expect(row('layout.panes')?.hidden, room).toBe(true);
      expect(row('appearance.shutSidebar')?.hidden, room).toBe(true);
      expect(row('appearance.split')?.hidden, room).toBe(false); // two pages lays them out by it
    }
    await settings.set('appearance.room', 'panes');
    expect(tab('Lists')?.hidden).toBe(false);
    expect(row('layout.panes')?.hidden).toBe(false);
  });

  it('leaves a tab that just went from sight for one in sight', async () => {
    const screen = await screenOn('android');
    tab('Lists')?.click();
    await settings.set('appearance.room', 'one');
    screen.open();
    expect(tab('Lists')?.getAttribute('aria-current')).toBe('false');
    expect(document.querySelector('.settings__tab[aria-current="true"]')).not.toBeNull();
  });
});

describe('Page width (#62)', () => {
  it('shows only while the notes’ page has room round its sheet, as it opens', async () => {
    pageOf(600, 830); // a foldable in Panes: the line at Wide fills it
    const screen = await screenOn('darwin');
    expect(row('page.width')?.hidden).toBe(true);
    expect(row('appearance.frame')?.hidden).toBe(false);
    document.querySelector('.page__leaf')?.remove();
    pageOf(1000, 830);
    screen.open('Look');
    expect(row('page.width')?.hidden).toBe(false);
  });
});

describe('opening at a category (#49’s All settings)', () => {
  it('shows the category’s first tab, and with none named, the tab it was left at', async () => {
    const screen = await screenOn('darwin');
    tab('Editor')?.click();
    screen.open();
    expect(tab('Editor')?.getAttribute('aria-current')).toBe('true');
    screen.close();
    screen.open('Look');
    expect(tab('Appearance')?.getAttribute('aria-current')).toBe('true');
    expect(document.querySelector('.settings__crumbs')?.textContent).toBe(
      'Settings/Look/Appearance',
    );
  });
});
