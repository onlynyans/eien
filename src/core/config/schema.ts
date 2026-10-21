// Every setting, defined once (spec §6). The settings screen, the defaults,
// validation and storage all come from this list: adding a setting means
// adding one entry. A setting joins the list when what it changes exists.

import { GALLERY, isMineChoice } from '../themes';
import { faceChoices, MACHINE_FACES, TEXT_FACES } from './faces';

/** 'vault' travels with the notes (.eien/config.json); 'device' stays on this device. */
export type SettingScope = 'vault' | 'device';

/**
 * The settings screen's tabs, in order. Each sits in a category of the
 * screen's (ui/settings/places.ts); the vault's own settings are in tabs of
 * their own, under This vault. A tab with no settings isn't shown.
 */
export const SETTING_GROUPS = [
  'Appearance',
  'Type',
  'Page',
  'Themes',
  'Lists',
  'Editor',
  'Writing',
  'AO3',
] as const;
export type SettingGroup = (typeof SETTING_GROUPS)[number];

interface Common {
  /** The name in the file: "section.name". */
  readonly key: string;
  readonly label: string;
  readonly description: string;
  readonly scope: SettingScope;
  readonly group: SettingGroup;
  /** Only on these systems (Node's process.platform names); on every one when absent. */
  readonly platforms?: readonly string[];
  /** Only on a window wide enough for panes side by side: never a phone's (spec §10). */
  readonly wide?: true;
}

export interface ChoiceSetting extends Common {
  readonly type: 'choice';
  /** Each value and its name on the settings screen, in the order shown. */
  readonly choices: Readonly<Record<string, string>>;
  readonly default: string;
  /** Values no list can hold, also taken (a theme of the writer's own), and what they are. */
  readonly more?: { readonly accepts: (value: string) => boolean; readonly what: string };
}

export interface NumberSetting extends Common {
  readonly type: 'number';
  /** Whole steps of `step` from `min` to `max`: a percentage, or a weight. */
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly default: number;
}

export type Setting = ChoiceSetting | NumberSetting;

export const SETTINGS = [
  {
    key: 'appearance.scheme',
    label: 'Day or night',
    description:
      'Night is inkstone: the same warm colours, darkened. System follows this computer.',
    scope: 'device',
    group: 'Appearance',
    type: 'choice',
    choices: { system: 'System', day: 'Day', night: 'Night' },
    default: 'system',
  },
  {
    key: 'appearance.palette',
    label: 'Palette',
    description:
      'Eien’s own themes, then your own: each a file in the vault’s .eien/themes, so it travels with your notes.',
    scope: 'device',
    group: 'Themes',
    type: 'choice',
    // The gallery's, in its order (core/themes); a theme of the writer's own is "mine:<name>".
    choices: Object.fromEntries(GALLERY.map((theme) => [theme.id, theme.name])),
    more: { accepts: isMineChoice, what: 'a theme of your own (mine:<name>)' },
    default: 'washi',
  },
  {
    key: 'appearance.layout',
    label: 'Layout',
    description:
      'Where the page’s controls sit. Band: in a band above the page. Slip: on a slip floating over it. Running head: in one strip across the window.',
    scope: 'device',
    group: 'Appearance',
    type: 'choice',
    choices: { band: 'Band', slip: 'Slip', runhead: 'Running head' },
    default: 'band',
  },
  {
    key: 'appearance.runheadGround',
    label: 'Running head',
    description:
      'The Running head layout’s strip across the top of the window. Its ground is one of the theme’s own surfaces, so it follows any theme.',
    scope: 'device',
    group: 'Appearance',
    type: 'choice',
    choices: {
      desk: 'Desk',
      blotter: 'Blotter',
      band: 'Band',
      paper: 'Paper',
      selected: 'Selected',
    },
    default: 'desk',
  },
  {
    key: 'appearance.face',
    label: 'Typeface',
    description: 'For everything a person wrote: notes, titles, names.',
    scope: 'device',
    group: 'Type',
    type: 'choice',
    // One list of faces feeds both face settings (./faces.ts).
    choices: faceChoices(TEXT_FACES),
    default: 'newsreader',
  },
  {
    key: 'appearance.machineFace',
    label: 'Machine voice',
    description:
      'For what the machine counts and what you press: counts, labels, the status line, the Source view.',
    scope: 'device',
    group: 'Type',
    type: 'choice',
    choices: faceChoices(MACHINE_FACES),
    default: 'plex-mono',
  },
  {
    key: 'appearance.textSize',
    label: 'Text size',
    description: 'The typeface everywhere, from the size it’s tuned to.',
    scope: 'device',
    group: 'Type',
    type: 'number',
    min: 90,
    max: 130,
    step: 10,
    default: 100,
  },
  {
    key: 'appearance.nameWeight',
    label: 'Sidebar names',
    description: 'How heavy the names sit in the sidebar. The chosen one keeps this weight.',
    scope: 'device',
    group: 'Type',
    type: 'number',
    min: 400,
    max: 700,
    step: 100,
    default: 400,
  },
  {
    key: 'appearance.titleWeight',
    label: 'List titles',
    description: 'How heavy the titles sit in the note list. The chosen one is a step heavier.',
    scope: 'device',
    group: 'Type',
    type: 'number',
    min: 400,
    max: 700,
    step: 100,
    default: 400,
  },
  {
    key: 'appearance.density',
    label: 'Density',
    description: 'Compact keeps the type at its size and takes away space.',
    scope: 'device',
    group: 'Appearance',
    type: 'choice',
    choices: { comfortable: 'Comfortable', compact: 'Compact' },
    default: 'comfortable',
  },
  {
    key: 'appearance.frame',
    label: 'Page',
    description: 'A sheet on the blotter, or paper from edge to edge.',
    scope: 'device',
    group: 'Page',
    type: 'choice',
    choices: { sheet: 'Sheet', full: 'Full' },
    default: 'sheet',
  },
  {
    key: 'editor.focus',
    label: 'Focus',
    description: 'Fades back every paragraph but the one you’re writing. Also View → Focus Mode.',
    scope: 'device',
    group: 'Editor',
    type: 'choice',
    choices: { off: 'Off', on: 'On' },
    default: 'off',
  },
  {
    key: 'editor.typewriter',
    label: 'Typewriter scrolling',
    description:
      'Keeps the line you’re writing at the middle of the page as you type. Also in the View menu.',
    scope: 'device',
    group: 'Editor',
    type: 'choice',
    choices: { off: 'Off', on: 'On' },
    default: 'off',
  },
  {
    key: 'editor.spellcheck',
    label: 'Spellcheck',
    description:
      'Underlines the words macOS doesn’t know, with its own dictionary; right-click one for suggestions. Also Edit → Check Spelling While Typing.',
    scope: 'device',
    group: 'Editor',
    type: 'choice',
    choices: { off: 'Off', on: 'On' },
    default: 'off',
    // Only macOS has a checker of its own; elsewhere Electron would fetch dictionaries from Google.
    platforms: ['darwin'],
  },
  {
    key: 'books.numerals',
    label: 'Chapter numbers',
    description: 'How a book numbers its chapters, in its list and its breadcrumb.',
    scope: 'vault',
    group: 'Writing',
    type: 'choice',
    choices: { roman: 'i ii iii', arabic: '1 2 3' },
    default: 'roman',
  },
  {
    key: 'typography.quotes',
    label: 'Quotation marks',
    description: 'As you type them, and in what Copy for AO3 gives. Code keeps its own.',
    scope: 'vault',
    group: 'Writing',
    type: 'choice',
    choices: { curly: 'Curly “ ”', straight: 'Straight " "' },
    default: 'curly',
  },
  {
    key: 'ao3.sceneBreak',
    label: 'Scene breaks',
    description:
      'How Copy for AO3 gives a *** line: AO3’s blank line, rule, blank line, or the rule alone.',
    scope: 'vault',
    group: 'AO3',
    type: 'choice',
    choices: { spacer: 'Spaced rule', rule: 'Rule alone' },
    default: 'spacer',
  },
  {
    key: 'layout.panes',
    label: 'Panes',
    description: 'Two puts the notes in the sidebar’s tree, in place of the note list.',
    wide: true,
    scope: 'device',
    group: 'Lists',
    type: 'choice',
    choices: { three: 'Three', two: 'Two' },
    default: 'three',
  },
  {
    key: 'window.zoom',
    label: 'Interface zoom',
    description:
      'Every pane, as a browser zooms: View → Zoom In and Zoom Out, with the keyboard outside the page.',
    // Electron's own zoom (webContents): a phone has none.
    platforms: ['darwin', 'win32', 'linux'],
    scope: 'device',
    group: 'Appearance',
    type: 'number',
    min: 50,
    max: 200,
    step: 10,
    default: 100,
  },
  {
    key: 'page.zoom',
    label: 'Page zoom',
    description:
      'The page alone, the panes keeping their size: the same keys, with the keyboard in the page.',
    scope: 'device',
    group: 'Page',
    type: 'number',
    min: 50,
    max: 200,
    step: 10,
    default: 100,
  },
] as const satisfies readonly Setting[];

type Defined = (typeof SETTINGS)[number];
export type SettingKey = Defined['key'];
type ValueOf<D> = D extends { readonly more: object }
  ? string
  : D extends { readonly choices: infer C }
    ? keyof C & string
    : number;

/** A value for every setting, typed by its key. */
export type SettingValues = { readonly [K in SettingKey]: ValueOf<Extract<Defined, { key: K }>> };

/** Settings the menu turns on and off (View → Focus Mode…): each a choice of "off" and "on". */
export const TOGGLES = [
  'editor.focus',
  'editor.typewriter',
  'editor.spellcheck',
] as const satisfies readonly SettingKey[];
export type ToggleKey = (typeof TOGGLES)[number];

/** Whether `setting` is offered on the system named `platform` (process.platform), on a phone or not. */
export const offeredOn = (setting: Setting, platform: string, phone = false): boolean =>
  (setting.platforms === undefined || setting.platforms.includes(platform)) &&
  !(phone && setting.wide);
