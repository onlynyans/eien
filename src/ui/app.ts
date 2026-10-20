// The window: the settings and the look, the menu, and the vault shown —
// or the welcome, before one is chosen.

import { numberSetting, stepped, type ToggleKey } from '../core/config';
import type { Bridge } from '../platform/bridge';
import { applyLook } from './settings/look';
import { SettingsScreen } from './settings/settings-screen';
import { SettingsState } from './settings/settings-state';
import { type ShownVault, showVault } from './vault/vault-view';
import { renderWelcome } from './welcome/welcome';

const ZOOM = numberSetting('page.zoom');

export async function startApp(root: HTMLElement, bridge: Bridge): Promise<void> {
  // The look is set before anything is drawn, so nothing shows in the wrong face.
  const settings = await SettingsState.load(bridge.settings);
  applyLook(settings.values);
  settings.onChange((values) => applyLook(values));
  const screen = new SettingsScreen(document.body, settings, bridge.platform);
  let shown: ShownVault | null = null;

  const open = async () => {
    await shown?.stop();
    shown = null;
    const info = await bridge.vault.current();
    await settings.reload(); // the vault's own settings come with it
    if (info) shown = await showVault(root, bridge, info.name, settings, () => screen.open());
    else renderWelcome(root, chooseVault, bridge.platform);
  };
  const chooseVault = async () => {
    const info = await bridge.vault.choose();
    if (info) await open();
  };

  bridge.onMenu((command) => {
    if (command === 'open-vault') void chooseVault();
    else if (command === 'settings') screen.open();
    else if (command === 'zoom:in' || command === 'zoom:out' || command === 'zoom:reset') {
      const now = settings.values['page.zoom'];
      const next =
        command === 'zoom:reset'
          ? ZOOM.default
          : stepped(ZOOM, now, command === 'zoom:in' ? 1 : -1);
      if (next !== now) void settings.set('page.zoom', next).catch(console.error);
    } else if (command.startsWith('toggle:')) {
      // Focus mode, typewriter scrolling: the menu's check follows the setting.
      const key = command.slice('toggle:'.length) as ToggleKey;
      void settings.set(key, settings.values[key] === 'on' ? 'off' : 'on').catch(console.error);
    }
  });
  bridge.onBeforeClose(async () => {
    await shown?.flush();
  });
  await open();
}
