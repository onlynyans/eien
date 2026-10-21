// Every control the window draws as an icon, once: its id, its icon, its
// name, its key, and what it runs (the menu's command, through the MenuBus,
// or one of the window's own). Where each is drawn is the layout's business
// (./layouts.ts); how it looks right now, the vault's (../vault/chrome-wiring.ts).

import type { SettingValues } from '../../core/config';
import type { MenuCommand } from '../../platform/bridge';
import type { IconName } from '../icons';

/** The window's three layouts (spec §4): A · Band, B · Slip, C · Running head. */
export type Layout = SettingValues['appearance.layout'];
export const LAYOUTS: readonly Layout[] = ['band', 'slip', 'runhead'];

export interface CommandDef {
  readonly id: string;
  /** Its icon; `seal` is the seal itself, the one control that isn't a drawing. */
  readonly icon: IconName | 'seal';
  /** Its name: the control's accessible name, and the tooltip's word. */
  readonly label: string;
  /** The tooltip's words, where they say more than the name. */
  readonly tip?: string;
  /** Its key, as CodeMirror writes keys (./keys.ts). */
  readonly key?: string;
  /** The menu's command it runs; without one, it's the window's own (`local` in ./chrome.ts). */
  readonly sends?: MenuCommand;
  /** Drawn on a phone only: on the desktop the menu bar holds it. */
  readonly phone?: true;
  /** Drawn in these layouts only: C's running head never hides, so has no strip to hide. */
  readonly layouts?: readonly Layout[];
}

export const COMMANDS = [
  { id: 'pane.sidebar', icon: 'sidebar', label: 'Sidebar', key: 'Mod-\\', sends: 'panes:sidebar' },
  {
    id: 'pane.list',
    icon: 'list',
    label: 'Note list',
    key: 'Mod-Shift-\\',
    sends: 'panes:list',
  },
  {
    id: 'view.live',
    icon: 'live',
    label: 'Live',
    tip: 'Live: formatting shown',
    sends: 'view:live',
  },
  {
    id: 'view.source',
    icon: 'source',
    label: 'Source',
    tip: 'Source: the Markdown',
    sends: 'view:source',
  },
  {
    id: 'view.reading',
    icon: 'reading',
    label: 'Reading',
    tip: 'Reading: read only',
    sends: 'view:reading',
  },
  { id: 'view.next', icon: 'live', label: 'View', key: 'Mod-e', sends: 'view:next', phone: true },
  {
    id: 'compare',
    icon: 'compare',
    label: 'Compare',
    tip: 'Compare with the last seal',
    key: 'Mod-Shift-d',
    sends: 'compare',
  },
  {
    id: 'seal',
    icon: 'seal',
    label: 'Seal',
    tip: 'Seal this version',
    key: 'Mod-s',
    sends: 'seal',
  },
  { id: 'versions', icon: 'versions', label: 'Versions', sends: 'versions' },
  {
    id: 'focus',
    icon: 'focus',
    label: 'Focus mode',
    tip: 'Focus: only the paragraph you’re in',
    key: 'Mod-Shift-Enter',
    sends: 'toggle:editor.focus',
  },
  { id: 'strip', icon: 'up', label: 'Page controls', layouts: ['band', 'slip'] },
  { id: 'scheme', icon: 'sun', label: 'Night' },
  { id: 'panes', icon: 'panes3', label: 'Two panes' },
  { id: 'settings', icon: 'settings', label: 'Settings', key: 'Mod-,', sends: 'settings' },
  { id: 'more', icon: 'more', label: 'More', phone: true },
] as const satisfies readonly CommandDef[];

export type CommandId = (typeof COMMANDS)[number]['id'];

/** The commands with no menu command of their own: the window runs them. */
export type LocalCommandId = Exclude<
  (typeof COMMANDS)[number],
  { readonly sends: MenuCommand }
>['id'];

const BY_ID = new Map<string, CommandDef>(COMMANDS.map((command) => [command.id, command]));

export const commandOf = (id: CommandId): CommandDef => BY_ID.get(id) as CommandDef;

/** Whether `command` is drawn on the desktop in `layout`. */
export const onDesktopIn = (command: CommandDef, layout: Layout): boolean =>
  !command.phone && (command.layouts?.includes(layout) ?? true);
