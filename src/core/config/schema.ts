// Every setting, defined once (spec §6). The settings screen, the defaults,
// validation and storage all come from this list: adding a setting means
// adding one entry. A setting joins the list when what it changes exists.

/** 'vault' travels with the notes (.eien/config.json); 'device' stays on this device. */
export type SettingScope = 'vault' | 'device';

/** The settings screen's sections, in order. A section with no settings isn't shown. */
export const SETTING_GROUPS = ['Appearance', 'Editor', 'Writing', 'Layout', 'AO3', 'Sync'] as const;
export type SettingGroup = (typeof SETTING_GROUPS)[number];

interface Common {
  /** The name in the file: "section.name". */
  readonly key: string;
  readonly label: string;
  readonly description: string;
  readonly scope: SettingScope;
  readonly group: SettingGroup;
}

export interface ChoiceSetting extends Common {
  readonly type: 'choice';
  /** Each value and its name on the settings screen, in the order shown. */
  readonly choices: Readonly<Record<string, string>>;
  readonly default: string;
}

export interface NumberSetting extends Common {
  readonly type: 'number';
  /** Whole steps of `step` from `min` to `max`, as a percentage. */
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
      'Washi is Eien’s paper and sumi ink. Otaku is cool grey round warm paper, with a burnt-orange accent.',
    scope: 'device',
    group: 'Appearance',
    type: 'choice',
    choices: { washi: 'Washi', otaku: 'Otaku' },
    default: 'washi',
  },
  {
    key: 'appearance.face',
    label: 'Typeface',
    description:
      'For everything a person wrote: notes, titles, names. Counts and buttons keep IBM Plex Mono.',
    scope: 'device',
    group: 'Appearance',
    type: 'choice',
    choices: {
      newsreader: 'Newsreader',
      literata: 'Literata',
      'plex-sans': 'IBM Plex Sans',
      'source-sans': 'Source Sans 3',
      atkinson: 'Atkinson Hyperlegible Next',
      schibsted: 'Schibsted Grotesk',
      hanken: 'Hanken Grotesk',
      instrument: 'Instrument Sans',
    },
    default: 'newsreader',
  },
  {
    key: 'appearance.textSize',
    label: 'Text size',
    description: 'The typeface everywhere, from the size it’s tuned to.',
    scope: 'device',
    group: 'Appearance',
    type: 'number',
    min: 90,
    max: 130,
    step: 10,
    default: 100,
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
    group: 'Appearance',
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
    key: 'books.numerals',
    label: 'Chapter numbers',
    description: 'How a book numbers its chapters in the note list.',
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
    scope: 'device',
    group: 'Layout',
    type: 'choice',
    choices: { three: 'Three', two: 'Two' },
    default: 'three',
  },
  {
    key: 'page.zoom',
    label: 'Zoom',
    description: 'The page only; the panes keep their size. Also in the View menu.',
    scope: 'device',
    group: 'Layout',
    type: 'number',
    min: 50,
    max: 200,
    step: 10,
    default: 100,
  },
] as const satisfies readonly Setting[];

type Defined = (typeof SETTINGS)[number];
export type SettingKey = Defined['key'];
type ValueOf<D> = D extends { readonly choices: infer C } ? keyof C & string : number;

/** A value for every setting, typed by its key. */
export type SettingValues = { readonly [K in SettingKey]: ValueOf<Extract<Defined, { key: K }>> };

/** Settings the menu turns on and off (View → Focus Mode…): each a choice of "off" and "on". */
export const TOGGLES = [
  'editor.focus',
  'editor.typewriter',
] as const satisfies readonly SettingKey[];
export type ToggleKey = (typeof TOGGLES)[number];
