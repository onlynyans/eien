// The phone's preload: the bridge the window reaches as `window.eien`, set
// before the window's own script (ui/main.ts) runs, as Electron's preload
// sets it on the desktop. The page is the desktop's (vite.mobile.config.ts).
// The window saves when the app goes to the background — Android may end it
// there — and looks at the vault again when it comes back.

import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import type { Bridge } from '../../platform/bridge';
import { preferencesStore } from '../../platform/capacitor/preferences-store';
import { SettingsStore } from '../../platform/settings-store';
import { MobileVault } from './mobile-vault';
import { phoneOut } from './phone-out';
import { vaultHome } from './vault-home';

function mobileBridge(): Bridge {
  const platform = Capacitor.getPlatform(); // 'android', 'ios' or 'web'
  const home = vaultHome(platform);
  const vault = new MobileVault(home, () => document.visibilityState === 'visible');
  const settings = new SettingsStore(preferencesStore, () => vault.open?.storage ?? null);
  void App.addListener('resume', () => vault.lookNow());
  const backs: (() => boolean)[] = [];
  void App.addListener('backButton', () => {
    for (const handler of [...backs].reverse()) if (handler()) return;
    void App.minimizeApp().catch(() => undefined); // nothing to go back to: step aside
  });
  return {
    platform,
    vault,
    settings: {
      // The window reads its settings before it asks for the vault; the desktop's is open by
      // then, and on the phone it opens now, so the vault's own settings are there from the start.
      read: async () => {
        await vault.current().catch(() => null); // a failure shows when the window asks for it
        return settings.all();
      },
      set: (key, value) => settings.set(key, value),
    },
    out: phoneOut(home.exports, home.exportFolder),
    onMenu: () => () => undefined, // no menu bar on a phone: the page's ⋯ (ui/phone)
    onBack(handler) {
      backs.push(handler);
      return () => {
        const at = backs.lastIndexOf(handler);
        if (at >= 0) backs.splice(at, 1);
      };
    },
    onBeforeClose(save) {
      void App.addListener('pause', () => void save().catch(console.error));
    },
    paintControls: async () => undefined, // a phone has no window controls
  };
}

Object.defineProperty(window, 'eien', { value: mobileBridge(), enumerable: true });
