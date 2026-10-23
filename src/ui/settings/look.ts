// How the window shows the settings (spec §6): each is a data attribute on
// <html> or a custom property (./look-properties.ts), and the tokens follow. Day or night is also
// the main process's (nativeTheme), so the window's frame follows it and
// it's right before the window first draws. The palette is worn by
// ../theme/wear.ts, as it may be one of the vault's own themes.

import { DEFAULT_SETTINGS, type SettingKey, type SettingValues } from '../../core/config';
import { lookProperties } from './look-properties';

/** Settings that are a data attribute on <html>; at the default, there's none. */
const LOOK_ATTRIBUTES = {
  'appearance.face': 'face',
  'appearance.density': 'density',
  'appearance.frame': 'frame',
} as const satisfies Partial<Record<SettingKey, string>>;

/** Settings that are always a data attribute on <html>, each stylesheet naming its own value. */
const NAMED = {
  'appearance.layout': 'layout',
  'appearance.split': 'split',
  'appearance.facingMark': 'facingMark',
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
  // Always set, the default too: each layout's stylesheet names its own (ui/chrome), as each split
  // mode's and mark's do (ui/page). Only when it changes: setting it again restyles the window,
  // every row of a long tree with it.
  for (const [key, name] of Object.entries(NAMED)) {
    const value = values[key as keyof typeof NAMED];
    if (root.dataset[name] !== value) root.dataset[name] = value;
  }
  // Shut sidebar is Band's and Slip's (../sidebar/sidebar.css): Running head's shut sidebar is
  // always its strip, as its running head holds the system's controls (../chrome/runhead.css).
  const shut =
    values['appearance.layout'] === 'runhead' ? undefined : values['appearance.shutSidebar'];
  if (root.dataset.shutSidebar !== shut) {
    if (shut) root.dataset.shutSidebar = shut;
    else delete root.dataset.shutSidebar;
  }
  for (const [key, name] of Object.entries(LOOK_ATTRIBUTES)) {
    const value = values[key as keyof typeof LOOK_ATTRIBUTES];
    if (value === DEFAULT_SETTINGS[key as keyof typeof LOOK_ATTRIBUTES]) delete root.dataset[name];
    else root.dataset[name] = value;
  }
  root.style.setProperty('--eien-text-scale', String(values['appearance.textSize'] / 100));
  root.style.setProperty('--eien-zoom', String(values['page.zoom'] / 100));
  for (const [name, value] of Object.entries(lookProperties(values))) {
    if (value === null) root.style.removeProperty(name);
    else root.style.setProperty(name, value);
  }
}
