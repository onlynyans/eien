// The window: the settings and the look, the menu, and the vault shown —
// or the welcome, before one is chosen.

import { offeredOn, settingOf, type ToggleKey } from '../core/config';
import type { Bridge } from '../platform/bridge';
import { MenuBus } from './menu/menu-bus';
import { applyLook } from './settings/look';
import { SettingsScreen } from './settings/settings-screen';
import { SettingsState } from './settings/settings-state';
import { isZoomCommand, keyboardInPage, zoomedBy, zoomKeyFor } from './settings/zoom';
import { followControlsLeft } from './shell/controls-left';
import { paintWindowControls } from './shell/window-controls';
import { wear, wornFor } from './theme/wear';
import { WriterThemes } from './theme/writer-themes';
import { type ShownVault, showVault } from './vault/vault-view';
import { renderWelcome } from './welcome/welcome';

export async function startApp(root: HTMLElement, bridge: Bridge): Promise<void> {
  // The look is set before anything is drawn, so nothing shows in the wrong face.
  const settings = await SettingsState.load(bridge.settings);
  const themes = new WriterThemes(bridge.vault, settings);
  // The vault's own themes come with the vault: until then, one of them is worn as Paper.
  const wearChosen = () => wear(wornFor(settings.values['appearance.palette'], themes.list));
  applyLook(settings.values);
  wearChosen();
  const repaintControls = paintWindowControls(bridge);
  followControlsLeft();
  settings.onChange((values) => {
    applyLook(values);
    wearChosen();
    repaintControls();
  });
  // Another window here changed a setting: this one follows.
  bridge.settings.onChanged?.(() => void settings.reload());
  themes.onChange(() => {
    wearChosen();
    repaintControls();
  });
  const screen = new SettingsScreen(document.body, settings, bridge.platform, themes);
  const menu = new MenuBus(bridge);
  const whole = settingOf('window.zoom');
  const wholeZoom = whole !== undefined && offeredOn(whole, bridge.platform);
  let shown: ShownVault | null = null;

  const openNow = async () => {
    await shown?.stop();
    shown = null;
    const info = await bridge.vault.current();
    await settings.reload(); // the vault's own settings come with it
    await themes.reload(); // and its own themes
    if (info) shown = await showVault(root, bridge, info.name, settings, menu, info.syncthing);
    else renderWelcome(root, chooseVault, bridge.platform);
  };
  // One at a time: a second open (a double tap on Allow) waits, then stops the first view.
  let opening: Promise<void> = Promise.resolve();
  const open = () => {
    opening = opening.then(openNow, openNow);
    return opening;
  };
  const chooseVault = async () => {
    const info = await bridge.vault.choose();
    if (info) await open();
  };

  menu.on((command) => {
    if (command === 'open-vault') void chooseVault();
    else if (command === 'settings') screen.open();
    else if (isZoomCommand(command)) {
      const key = zoomKeyFor(keyboardInPage(), wholeZoom);
      const now = settings.values[key];
      const next = zoomedBy(command, key, now);
      if (next !== now) void settings.set(key, next).catch(console.error);
    } else if (command.startsWith('toggle:')) {
      // Focus mode, typewriter scrolling: the menu's check follows the setting.
      const key = command.slice('toggle:'.length) as ToggleKey;
      void settings.set(key, settings.values[key] === 'on' ? 'off' : 'on').catch(console.error);
    }
  });
  // A phone's back: the settings close first, then the vault goes back a pane.
  bridge.onBack(() => {
    if (!screen.isOpen) return shown?.back() ?? false;
    screen.close();
    return true;
  });
  bridge.onBeforeClose(async () => {
    await shown?.flush();
  });
  await open();
}
