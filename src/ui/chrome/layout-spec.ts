// What a layout is: the hosts it draws, each in one of the window's slots,
// each holding a list of commands (./commands.ts). The hosts all three
// share are here; each layout's own are in ./band.ts, ./slip.ts, ./runhead.ts.

import type { IconName } from '../icons';
import { type CommandId, commandOf } from './commands';

/**
 * The places a host can go, each an element the window keeps (../vault/vault-view.ts):
 * - `top`: a strip across the whole window, above the panes (C's running head);
 * - `pageBar`: the page's top row; `format`: the row under it, for the formatting bar;
 * - `sidebarChevron`, `listChevron`: at each pane's edge, to shut it and open it again;
 * - `foot`: the sidebar's foot; `phoneBar`, `phoneFoot`: a phone's top bar, and the page's foot.
 */
export type SlotName =
  | 'top'
  | 'pageBar'
  | 'format'
  | 'sidebarChevron'
  | 'listChevron'
  | 'foot'
  | 'phoneBar'
  | 'phoneFoot';

/** A command; a hairline between two runs ('|'); or commands that make one choice (the views). */
export type HostItem =
  | CommandId
  | '|'
  | { readonly group: string; readonly ids: readonly CommandId[] };

export interface HostSpec {
  /** Its class, `host--<name>`, which the layout's stylesheet styles. */
  readonly name: string;
  readonly slot: SlotName;
  /** Its accessible name, as a toolbar. */
  readonly label: string;
  readonly items: readonly HostItem[];
  /** First in its slot, before what's there; else last. */
  readonly first?: true;
  /** A command drawn with another icon here (a pane's chevron, not its picture). */
  readonly icons?: Partial<Record<CommandId, IconName>>;
  /**
   * Short of room in its bar, these fold behind a ⋯, first first (./fold.ts); the rest never
   * do. Only a host that's a row across its bar has them.
   */
  readonly folds?: readonly CommandId[];
}

/**
 * The page's tools, as they fold: the least asked for first, the look last of the tools; the views (as one) only on a page
 * too narrow for them and a ⋯, and the seal last. Never the strip: the shut band's way back.
 */
export const TOOL_FOLDS: readonly CommandId[] = [
  'versions',
  'compare',
  'format-bar',
  'focus',
  'marks',
  'bookmark',
  'find',
  'look',
  'view.live',
  'view.source',
  'view.reading',
  'view.pages',
  'view.scroll',
  'seal',
];

/**
 * A phone's tools, as they fold short of room (#64): only what its ⋯ offers too, so folding
 * takes a button out of the bar and adds no second ⋯; the least asked for first, the bookmark
 * (one tap, on the page) and Look last. The views and the ⋯ never fold.
 */
export const PHONE_FOLDS: readonly CommandId[] = [
  'focus',
  'seal',
  'marks',
  'find',
  'bookmark',
  'look',
];

/** Where a layout shows the note's tags (backlog #13), each a slot the page keeps (../page/page.ts). */
export type TagSlot = 'runningHead' | 'underTitle' | 'colophon';

/** On a phone, whatever the layout, the tags are slips under the title: big enough to touch. */
export const PHONE_TAGS: TagSlot = 'underTitle';

export interface LayoutSpec {
  /** The hosts on a desktop's window: every command it draws in exactly one. */
  readonly desktop: readonly HostSpec[];
  /** The page's controls on a phone, one host. */
  readonly phone: HostSpec;
  /** Where the note's tags go: A at the sheet's running head, B as slips under the title, C in the colophon. */
  readonly tags: TagSlot;
  /**
   * The host holding the page's tools, by name: while split, the split's
   * own commands for the pages (../chrome/splits.ts) join its end, and a
   * folded split's pager stands before it.
   */
  readonly tools: string;
}

const VIEW_IDS: readonly CommandId[] = [
  'view.live',
  'view.source',
  'view.reading',
  'view.pages',
  'view.scroll',
];

/** The page's views, one choice: a note's three, or a book's two (only a page's own kind shows). */
export const VIEWS: HostItem = { group: 'View', ids: VIEW_IDS };

/**
 * A book's views alone, the commands marked for a book (#63): for a phone's bar that gives a
 * note's views one button that steps through them (A's `view.next`).
 */
export const BOOK_VIEWS: HostItem = {
  group: 'View',
  ids: VIEW_IDS.filter((id) => commandOf(id).on === 'epub'),
};

/**
 * The formatting bar (#14): the Format menu's commands, in its runs; shown by the setting. A row
 * across the page (A's) folds, as FORMAT_FOLDS says; a floating slip or rail (B's, C's) wraps
 * instead (./slip.css, ./runhead.css), having no bar to measure against.
 */
export const formatBar = (name: string): HostSpec => ({
  name,
  slot: 'format',
  label: 'Format',
  items: [
    'format.bold',
    'format.italic',
    'format.underline',
    'format.strike',
    '|',
    'format.heading',
    'format.highlight',
    'format.link',
    '|',
    'format.quote',
    'format.bullet',
    'format.numbered',
    'format.checklist',
    '|',
    'format.table',
  ],
});

/** The sidebar's foot (#8): day or night, three panes or two, the settings. */
export const FOOT: HostSpec = {
  name: 'foot',
  slot: 'foot',
  label: 'Window',
  items: ['scheme', 'panes', 'settings'],
};

/** A chevron at each pane's edge that shuts it, and opens it again (#15): A's and B's. */
export const CHEVRONS: readonly HostSpec[] = [
  {
    name: 'chevron',
    slot: 'sidebarChevron',
    label: 'Sidebar',
    items: ['pane.sidebar'],
    icons: { 'pane.sidebar': 'left' },
  },
  {
    name: 'chevron',
    slot: 'listChevron',
    label: 'Note list',
    items: ['pane.list'],
    icons: { 'pane.list': 'left' },
  },
];

/** The commands `items` holds, in order. */
export const idsIn = (items: readonly HostItem[]): CommandId[] =>
  items.flatMap((item) => (item === '|' ? [] : typeof item === 'string' ? [item] : item.ids));

/** The formatting bar's commands as they fold: from its end, bold and italic staying. */
export const FORMAT_FOLDS: readonly CommandId[] = idsIn(formatBar('').items).slice(2).reverse();
