// Where each setting sits in Settings (settings.md): categories, labelled in
// the machine voice like a book's part titles, each holding tabs. A tab is
// one of the schema's groups, or one of the Themes tabs. This vault's own
// settings have a category of their own, apart from this device's (#31).

import {
  offeredOn,
  SETTINGS,
  type Setting,
  type SettingGroup,
  type SettingScope,
} from '../../core/config';
import type { IconName } from '../icons';

/** A tab drawn by its own module, not from the schema's list. */
export type ThemesTab = 'Gallery' | 'Custom';

export interface Tab {
  readonly name: string;
  /** The schema's group it holds; a Themes tab draws it (the palette) as cards of its own. */
  readonly group?: SettingGroup;
  readonly themes?: ThemesTab;
}

export interface Category {
  readonly name: string;
  readonly icon: IconName;
  /** Whose settings: this device's, or the vault's, which travel with it. */
  readonly scope: SettingScope;
  readonly tabs: readonly Tab[];
}

const group = (name: SettingGroup): Tab => ({ name, group: name });

export const CATEGORIES: readonly Category[] = [
  {
    name: 'Look',
    icon: 'type',
    scope: 'device',
    tabs: [group('Appearance'), group('Type'), group('Page')],
  },
  {
    name: 'Themes',
    icon: 'palette',
    scope: 'device',
    // Both choose the palette: Eien's own, and the writer's.
    tabs: [
      { name: 'Gallery', group: 'Themes', themes: 'Gallery' },
      { name: 'Custom', themes: 'Custom' },
    ],
  },
  { name: 'Writing', icon: 'live', scope: 'device', tabs: [group('Lists'), group('Editor')] },
  {
    name: 'This vault',
    icon: 'folder',
    scope: 'vault',
    tabs: [group('Writing'), group('AO3')],
  },
];

/** The settings a tab holds, offered here (`platform`, a phone or not), in the schema's order. */
export function settingsIn(tab: Tab, platform: string, phone: boolean): Setting[] {
  return SETTINGS.filter(
    (setting) => setting.group === tab.group && offeredOn(setting, platform, phone),
  );
}

/** Every category, with only the tabs that show something here. */
export function placesHere(platform: string, phone: boolean): Category[] {
  return CATEGORIES.map((category) => ({
    ...category,
    tabs: category.tabs.filter(
      (tab) => tab.themes !== undefined || settingsIn(tab, platform, phone).length > 0,
    ),
  })).filter((category) => category.tabs.length > 0);
}
