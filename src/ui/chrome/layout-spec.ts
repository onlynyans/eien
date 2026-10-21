// What a layout is: the hosts it draws, each in one of the window's slots,
// each holding a list of commands (./commands.ts). The hosts all three
// share are here; each layout's own are in ./band.ts, ./slip.ts, ./runhead.ts.

import type { IconName } from '../icons';
import type { CommandId } from './commands';

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
}

/** Where a layout shows the note's tags (backlog #13), each a slot the page keeps (../page/page.ts). */
export type TagSlot = 'runningHead' | 'underTitle' | 'colophon';

export interface LayoutSpec {
  /** The hosts on a desktop's window: every command it draws in exactly one. */
  readonly desktop: readonly HostSpec[];
  /** The page's controls on a phone, one host. */
  readonly phone: HostSpec;
  /** Where the note's tags go: A at the sheet's running head, B as slips under the title, C in the colophon. */
  readonly tags: TagSlot;
}

/** The page's three views, one choice. */
export const VIEWS: HostItem = {
  group: 'View',
  ids: ['view.live', 'view.source', 'view.reading'],
};

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
