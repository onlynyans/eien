// How the window shows the settings (spec §6–§7): each is a data attribute
// on <html> or a custom property, and the tokens follow. Day or night is
// also the main process's (nativeTheme), so the window's frame follows it
// and it's right before the window first draws.

import { DEFAULT_SETTINGS, type SettingKey, type SettingValues } from '../../core/config';

/** Settings that are a data attribute on <html>; at the default, there's none. */
const LOOK_ATTRIBUTES = {
  'appearance.palette': 'palette',
  'appearance.face': 'face',
  'appearance.density': 'density',
  'appearance.frame': 'frame',
} as const satisfies Partial<Record<SettingKey, string>>;

/** Day or night as the tokens' data-theme; the system's is no attribute. */
const THEMES = { system: undefined, day: 'light', night: 'dark' } as const;

export function applyLook(
  values: SettingValues,
  root: HTMLElement = document.documentElement,
): void {
  const theme = THEMES[values['appearance.scheme']];
  if (theme) root.dataset.theme = theme;
  else delete root.dataset.theme;
  for (const [key, name] of Object.entries(LOOK_ATTRIBUTES)) {
    const value = values[key as keyof typeof LOOK_ATTRIBUTES];
    if (value === DEFAULT_SETTINGS[key as keyof typeof LOOK_ATTRIBUTES]) delete root.dataset[name];
    else root.dataset[name] = value;
  }
  root.style.setProperty('--eien-text-scale', String(values['appearance.textSize'] / 100));
  root.style.setProperty('--eien-zoom', String(values['page.zoom'] / 100));
}
