// Every control the window draws as an icon, once: its id, its icon, its
// name, its key, and what it runs (the menu's command, through the MenuBus,
// or one of the window's own). Where each is drawn is the layout's business
// (./layouts.ts); how it looks right now, the vault's (../vault/chrome-wiring.ts).

import type { SettingValues } from '../../core/config';
import { FORMAT_COMMANDS, type FormatCommandId } from '../../core/format';
import type { MenuCommand } from '../../platform/bridge';
import type { IconName } from '../icons';
import type { PageKind } from '../page/page-leaf';

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
  /** Its key on Windows and Linux, where it isn't `key` (core/format's headings). */
  readonly keyOffMac?: string;
  /** `key` is the first of a run of keys, through this last one: ⌘⌥1–3 for the headings. */
  readonly keyThrough?: string;
  /** The menu's command it runs; without one, it's the window's own (`local` in ./chrome.ts). */
  readonly sends?: MenuCommand;
  /** Drawn on a phone only: on the desktop the menu bar holds it. */
  readonly phone?: true;
  /** Drawn in these layouts only: C's running head never hides, so has no strip to hide. */
  readonly layouts?: readonly Layout[];
  /** Drawn only while the window is split, where the split's mode puts it (./splits.ts). */
  readonly split?: true;
  /**
   * The kind of page it acts on (a note's views, seals and formats); without
   * it, any page, or the window. A page of another kind has it disabled.
   */
  readonly on?: PageKind;
}

/** The formatting bar's commands (#14), each the Format menu's, in the bar's order. */
const BAR_FORMATS = {
  bold: 'bold',
  italic: 'italic',
  underline: 'underline',
  strike: 'strike',
  highlight: 'highlight',
  link: 'link',
  quote: 'quote',
  bullet: 'bullets',
  numbered: 'numbers',
  checklist: 'checklist',
  table: 'table',
} as const satisfies Partial<Record<FormatCommandId, IconName>>;
type BarFormat = keyof typeof BAR_FORMATS;

/** A Format menu command as a control: its name and key are the menu's own (core/format). */
const formatControl = (id: BarFormat) => {
  const command = FORMAT_COMMANDS.find((each) => each.id === id);
  return {
    id: `format.${id}` as `format.${BarFormat}`,
    icon: BAR_FORMATS[id],
    label: command?.label ?? id,
    key: command?.key,
    sends: `format:${id}` as const,
    on: 'note' as const,
  };
};

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
    tip: 'Live: formatting shown as you write',
    sends: 'view:live',
    on: 'note',
  },
  {
    id: 'view.source',
    icon: 'source',
    label: 'Source',
    tip: 'Source: edit the raw Markdown',
    sends: 'view:source',
    on: 'note',
  },
  {
    id: 'view.reading',
    icon: 'reading',
    label: 'Reading',
    tip: 'Reading: read only',
    sends: 'view:reading',
    on: 'note',
  },
  {
    id: 'view.next',
    icon: 'live',
    label: 'View',
    key: 'Mod-e',
    sends: 'view:next',
    phone: true,
    on: 'note',
  },
  {
    id: 'compare',
    icon: 'compare',
    label: 'Compare',
    tip: 'Compare with the last saved version',
    key: 'Mod-Shift-d',
    sends: 'compare',
    on: 'note',
  },
  {
    id: 'seal',
    icon: 'seal',
    label: 'Seal',
    tip: 'Seal this version',
    key: 'Mod-s',
    sends: 'seal',
    on: 'note',
  },
  { id: 'versions', icon: 'versions', label: 'Versions', sends: 'versions', on: 'note' },
  {
    id: 'copy-html',
    icon: 'copy',
    label: 'Copy as HTML',
    key: 'Mod-Shift-c',
    sends: 'copy-html',
    split: true,
    on: 'note',
  },
  { id: 'page.close', icon: 'close', label: 'Close this page', key: 'Mod-w', split: true },
  { id: 'pages.swap', icon: 'swap', label: 'Swap the pages', sends: 'split:swap', split: true },
  { id: 'page.lead', icon: 'swap', label: 'Make it the page', sends: 'split:swap', split: true },
  { id: 'page.more', icon: 'more', label: 'More for this note', split: true, on: 'note' },
  {
    id: 'focus',
    icon: 'focus',
    label: 'Focus mode',
    tip: 'Focus mode: dim all but the current paragraph',
    key: 'Mod-Shift-Enter',
    sends: 'toggle:editor.focus',
    on: 'note',
  },
  // The quick look (#49): a note's look, or with a book in front the shelf's (#40).
  { id: 'look', icon: 'look', label: 'Look', key: 'Mod-Shift-l', sends: 'look' },
  { id: 'strip', icon: 'up', label: 'Page controls', layouts: ['band', 'slip'] },
  { id: 'scheme', icon: 'sun', label: 'Night' },
  { id: 'panes', icon: 'panes3', label: 'Two panes' },
  { id: 'settings', icon: 'settings', label: 'Settings', key: 'Mod-,', sends: 'settings' },
  { id: 'more', icon: 'more', label: 'More', phone: true },
  {
    id: 'format-bar',
    icon: 'format',
    label: 'Formatting bar',
    key: 'Mod-Shift-b',
    sends: 'toggle:editor.formatBar',
  },
  ...(Object.keys(BAR_FORMATS) as BarFormat[]).map(formatControl),
  // One control for the three headings: each press a level down (core/format, nextHeading).
  {
    id: 'format.heading',
    icon: 'heading',
    label: 'Heading',
    tip: 'Heading: 1, 2, 3, then none',
    key: 'Mod-Alt-1',
    keyOffMac: 'Mod-Shift-1',
    keyThrough: '3',
    on: 'note',
  },
] as const satisfies readonly CommandDef[];

export type CommandId = (typeof COMMANDS)[number]['id'];

/** The commands with no menu command of their own: the window runs them. */
export type LocalCommandId = Exclude<
  (typeof COMMANDS)[number],
  { readonly sends: MenuCommand }
>['id'];

const BY_ID = new Map<string, CommandDef>(COMMANDS.map((command) => [command.id, command]));

export const commandOf = (id: CommandId): CommandDef => BY_ID.get(id) as CommandDef;

/** Whether `id` acts on a page of `kind`: the window's commands act on any. */
export const actsOn = (id: CommandId, kind: PageKind): boolean => {
  const { on } = commandOf(id);
  return on === undefined || on === kind;
};

/** Whether `command` is drawn on the desktop in `layout`, with one page (a split's own are its mode's). */
export const onDesktopIn = (command: CommandDef, layout: Layout): boolean =>
  !command.phone && !command.split && (command.layouts?.includes(layout) ?? true);
