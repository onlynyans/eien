// Every setting, defined once (spec §6). The settings screen, the defaults,
// validation and storage all come from this list: adding a setting means
// adding one entry. A setting joins the list when what it changes exists.

import { GALLERY, isMineChoice } from '../themes';
import { faceChoices, INTERFACE_FACES, TEXT_FACES } from './faces';

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
  /**
   * In the quick look (#49, ui/quick-look): one value for every page (`window`), or a page's own
   * (`page`): the notes' under this key, and from #40 Phase 1 the shelf's under `epub.<key>`,
   * from this same entry.
   */
  readonly quick?: 'window' | 'page';
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
    description: 'Use a light or dark appearance, or match your system setting.',
    scope: 'device',
    group: 'Appearance',
    type: 'choice',
    choices: { system: 'System', day: 'Day', night: 'Night' },
    default: 'system',
    quick: 'window',
  },
  {
    key: 'appearance.palette',
    label: 'Palette',
    description:
      'The color theme. Themes you create are saved in the vault’s .eien/themes folder and sync with your notes.',
    scope: 'device',
    group: 'Themes',
    type: 'choice',
    // The gallery's, in its order (core/themes); a theme of the writer's own is "mine:<name>".
    choices: Object.fromEntries(GALLERY.map((theme) => [theme.id, theme.name])),
    more: { accepts: isMineChoice, what: 'a theme of your own (mine:<name>)' },
    default: 'paper',
  },
  {
    key: 'appearance.layout',
    label: 'Layout',
    description:
      'Where the page’s toolbar appears. Band: above the page. Slip: floating over the page. Running head: in a strip across the top of the window.',
    scope: 'device',
    group: 'Appearance',
    type: 'choice',
    choices: { band: 'Band', slip: 'Slip', runhead: 'Running head' },
    default: 'band',
  },
  {
    key: 'appearance.room',
    label: 'Wide screen',
    description:
      'How a screen wider than a phone’s (a foldable opened, a tablet, a phone turned sideways) is used. Panes: the desktop’s panes, at a finger’s size. One at a time: as on a phone. Side by side: the pane you came from beside the one you’re in. Two pages: the notes slide over the page, and the second note chosen opens beside the first, laid out as Split says.',
    // The phone's build (web: its page in tests/mobile): the desktop's window is always panes.
    platforms: ['android', 'ios', 'web'],
    scope: 'device',
    group: 'Appearance',
    type: 'choice',
    choices: { panes: 'Panes', one: 'One at a time', side: 'Side by side', pages: 'Two pages' },
    default: 'panes',
  },
  {
    key: 'appearance.split',
    label: 'Split',
    description:
      'How two notes side by side are laid out. Two sheets: two pages on one desk, one set of tools. Facing pages: one sheet opened like a book, each note’s own tools at its page’s foot. Companion: the second note beside the page, narrower, with its own few tools. Tools that follow: the note list steps aside, and the page’s tools stand over the page you’re in.',
    scope: 'device',
    group: 'Appearance',
    type: 'choice',
    choices: {
      sheets: 'Two sheets',
      facing: 'Facing pages',
      companion: 'Companion',
      follow: 'Tools that follow',
    },
    default: 'sheets',
  },
  {
    key: 'appearance.facingMark',
    label: 'Facing pages’ mark',
    description:
      'What marks the page you’re writing in, with Facing pages: a ribbon over its top edge, its corner turned down, or a tab at its outer edge.',
    scope: 'device',
    group: 'Appearance',
    type: 'choice',
    choices: { ribbon: 'Ribbon', dogear: 'Dog-ear', tab: 'Edge tab' },
    default: 'ribbon',
  },
  {
    key: 'appearance.narrowPages',
    label: 'Two pages when narrow',
    description:
      'Two notes stay side by side however narrow the screen (a foldable opened upright), each half of it. Off, short of room they do as Split says: fold into one page, close the book, put the companion under the page, or wait.',
    // The phone's build, where a screen can be too narrow for two and still show them.
    platforms: ['android', 'ios', 'web'],
    scope: 'device',
    group: 'Appearance',
    type: 'choice',
    choices: { off: 'Off', on: 'On' },
    default: 'off',
  },
  {
    key: 'appearance.shutSidebar',
    label: 'Shut sidebar',
    description:
      'What stays at the window’s left edge when the sidebar is hidden, in the Band and Slip layouts: the seal alone, or a narrow strip with the seal on it. Running head always keeps the strip.',
    wide: true,
    scope: 'device',
    group: 'Appearance',
    type: 'choice',
    choices: { seal: 'The seal alone', strip: 'A strip of desk' },
    default: 'seal',
  },
  {
    key: 'appearance.runheadGround',
    label: 'Running head',
    description:
      'The background color of the Running head strip. Each option uses a color from the current theme.',
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
    description: 'The font used for your notes, titles and names.',
    scope: 'device',
    group: 'Type',
    type: 'choice',
    // One list of faces feeds both face settings (./faces.ts).
    choices: faceChoices(TEXT_FACES),
    default: 'newsreader',
    quick: 'page',
  },
  {
    key: 'appearance.interfaceFace',
    label: 'Interface font',
    description: 'The font for labels, buttons, counts and the status bar.',
    scope: 'device',
    group: 'Type',
    type: 'choice',
    choices: faceChoices(INTERFACE_FACES),
    default: 'plex-mono',
  },
  {
    key: 'appearance.sourceFace',
    label: 'Source font',
    description: 'The font for Markdown in the Source view, and for code.',
    scope: 'device',
    group: 'Type',
    type: 'choice',
    choices: faceChoices(INTERFACE_FACES),
    default: 'plex-mono',
  },
  {
    key: 'appearance.textSize',
    label: 'Text size',
    description: 'Make text larger or smaller throughout the app.',
    scope: 'device',
    group: 'Type',
    type: 'number',
    min: 90,
    max: 130,
    step: 10,
    default: 100,
    quick: 'page',
  },
  {
    key: 'appearance.leading',
    label: 'Line spacing',
    description: 'Lines a little closer or further apart than the typeface sets them.',
    scope: 'device',
    group: 'Type',
    type: 'choice',
    // A step either side of each face's own leading (ui/settings/look-properties.ts).
    choices: { tight: 'Tight', set: 'As set', loose: 'Loose' },
    default: 'set',
    quick: 'page',
  },
  {
    key: 'appearance.nameWeight',
    label: 'Sidebar names',
    description: 'The font weight of names in the sidebar. The selected item uses the same weight.',
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
    description:
      'The font weight of titles in the note list. The selected note is one step bolder.',
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
    description: 'Compact reduces the spacing between items. Text size stays the same.',
    scope: 'device',
    group: 'Appearance',
    type: 'choice',
    choices: { comfortable: 'Comfortable', compact: 'Compact' },
    default: 'comfortable',
  },
  {
    key: 'page.width',
    label: 'Page width',
    description:
      'Lines a little shorter or longer than the typeface sets them, on a page with room round it.',
    // A phone's page is already narrower than any face's line.
    wide: true,
    scope: 'device',
    group: 'Page',
    type: 'choice',
    choices: { narrow: 'Narrow', set: 'As set', wide: 'Wide' },
    default: 'set',
    quick: 'page',
  },
  {
    key: 'appearance.frame',
    label: 'Page',
    description:
      'Show the page as a sheet with a margin around it, or fill the editor edge to edge.',
    scope: 'device',
    group: 'Page',
    type: 'choice',
    choices: { sheet: 'Sheet', full: 'Full' },
    default: 'sheet',
    quick: 'page',
  },
  {
    key: 'editor.focus',
    label: 'Focus',
    description: 'Dim every paragraph except the one you’re editing. Also in View → Focus Mode.',
    scope: 'device',
    group: 'Editor',
    type: 'choice',
    choices: { off: 'Off', on: 'On' },
    default: 'off',
  },
  {
    key: 'editor.formatBar',
    label: 'Formatting bar',
    description:
      'Show a toolbar above the page for bold, italic, headings, lists and other formatting. Also in View → Formatting Bar.',
    scope: 'device',
    group: 'Editor',
    type: 'choice',
    choices: { off: 'Off', on: 'On' },
    default: 'off',
    // A phone formats from the bar over a selection, and has no room for another.
    wide: true,
  },
  {
    key: 'editor.typewriter',
    label: 'Typewriter scrolling',
    description: 'Keep the current line vertically centered as you type. Also in the View menu.',
    scope: 'device',
    group: 'Editor',
    type: 'choice',
    choices: { off: 'Off', on: 'On' },
    default: 'off',
  },
  {
    key: 'editor.marks',
    label: 'Show Markdown marks',
    description:
      'Show the Markdown symbols around the text you’re editing in Live mode. Also in View → Show Markdown Marks.',
    scope: 'device',
    group: 'Editor',
    type: 'choice',
    choices: { off: 'Off', on: 'On' },
    // On, as Live has always been: the marks show the writer where a format starts and ends.
    default: 'on',
  },
  {
    key: 'editor.hideTagsAndIds',
    label: 'Hide tags and IDs',
    description:
      'Hide the tags: and id: lines at the top of a note, in Live, Source and Reading. They’re kept and saved as they are, and the note’s tags still show on the page.',
    scope: 'device',
    group: 'Editor',
    type: 'choice',
    choices: { off: 'Off', on: 'On' },
    // Off, as Eien has been: Source shows the file as it is, and the id a seal adds is already
    // out of sight in Live and Reading while it's all the front matter holds.
    default: 'off',
  },
  {
    key: 'editor.spellcheck',
    label: 'Spellcheck',
    description:
      'Underline misspelled words using the macOS dictionary. Right-click a word for suggestions. Also in Edit → Check Spelling While Typing.',
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
    description: 'The numbering style for chapters in a book’s list and breadcrumb.',
    scope: 'vault',
    group: 'Writing',
    type: 'choice',
    choices: { roman: 'i ii iii', arabic: '1 2 3' },
    default: 'roman',
  },
  {
    key: 'typography.quotes',
    label: 'Quotation marks',
    description:
      'The quotation marks inserted as you type and used in copied and exported HTML. Code is not affected.',
    scope: 'vault',
    group: 'Writing',
    type: 'choice',
    choices: { curly: 'Curly “ ”', straight: 'Straight " "' },
    default: 'curly',
  },
  {
    key: 'html.sceneBreak',
    label: 'Scene breaks',
    description:
      'How a *** scene break looks in copied and exported HTML: a rule with a blank line above and below it, or the rule only.',
    scope: 'vault',
    group: 'Writing',
    type: 'choice',
    choices: { spacer: 'Spaced rule', rule: 'Rule alone' },
    default: 'spacer',
  },
  {
    key: 'layout.panes',
    label: 'Panes',
    description:
      'With two panes, notes appear in the sidebar’s tree instead of a separate note list.',
    wide: true,
    scope: 'device',
    group: 'Lists',
    type: 'choice',
    choices: { three: 'Three', two: 'Two' },
    default: 'three',
  },
  {
    key: 'lists.arranging',
    label: 'Arranging',
    description:
      'When rows can be reordered by dragging. Drag anytime: whenever a custom order is shown. In Arrange mode: only after choosing Arrange in the list’s header, to prevent accidental moves.',
    // A phone moves rows by their menu, never a drag.
    wide: true,
    scope: 'device',
    group: 'Lists',
    type: 'choice',
    choices: { drag: 'Drag anytime', mode: 'In Arrange mode' },
    default: 'drag',
  },
  {
    key: 'window.zoom',
    label: 'Interface zoom',
    description:
      'Zoom the whole interface, as a browser zooms: everything larger or smaller, and laid out again to fit, so smaller gives more room. On the desktop, also View → Zoom In and Zoom Out, or the keyboard when the page isn’t focused.',
    // The desktop's window by Electron (app/electron/frame.ts); a phone's page by its viewport
    // (ui/settings/viewport.ts).
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
      'Zoom the page only; the panes keep their size. Uses the same shortcuts when the page is focused.',
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
/** The settings a page wears of its own (`quick: 'page'`, #49): the notes' look. */
export type PageLookKey = Extract<Defined, { readonly quick: 'page' }>['key'];
/** The shelf's look (#40): each page setting again, under `epub.<key>` (./epub-look.ts). */
export type EpubLookKey = `epub.${PageLookKey}`;
export type SettingKey = Defined['key'] | EpubLookKey;
type ValueOf<D> = D extends { readonly more: object }
  ? string
  : D extends { readonly choices: infer C }
    ? keyof C & string
    : number;

/** A value for every setting, typed by its key. */
export type SettingValues = {
  readonly [K in Defined['key']]: ValueOf<Extract<Defined, { key: K }>>;
} & {
  readonly [K in PageLookKey as `epub.${K}`]: ValueOf<Extract<Defined, { key: K }>>;
};

/** Settings the menu turns on and off (View → Focus Mode…): each a choice of "off" and "on". */
export const TOGGLES = [
  'editor.focus',
  'editor.formatBar',
  'editor.typewriter',
  'editor.marks',
  'editor.spellcheck',
] as const satisfies readonly SettingKey[];
export type ToggleKey = (typeof TOGGLES)[number];

/** Whether `setting` is offered on the system named `platform` (process.platform), on a phone or not. */
export const offeredOn = (setting: Setting, platform: string, phone = false): boolean =>
  (setting.platforms === undefined || setting.platforms.includes(platform)) &&
  !(phone && setting.wide);
