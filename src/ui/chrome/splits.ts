// The split's modes (spec §4, Split; the setting appearance.split), each a
// spec as each layout is (./layouts.ts): how much room two pages need, what
// the divider measures, what a pane too narrow for them does, which commands
// move from the layout's hosts onto a page's own (its head or its foot),
// which join the page's tools, which page the layout's tools act on, and
// where each note's figures go. With one page, every mode is the layout as
// it is.

import type { SettingValues } from '../../core/config';
import { PAGE_MIN } from '../shell/pane-state';
import { BESIDE, COMPANION, type Measure, SHARE, UNDER_PAGE } from '../shell/split-state';
import type { CommandId } from './commands';
import type { HostSpec, LayoutSpec } from './layout-spec';

export type SplitMode = SettingValues['appearance.split'];

export interface SplitSpec {
  /** The room, in pixels, two pages need side by side. */
  readonly least: number;
  /** What the divider measures, side by side (../shell/split-state.ts). */
  readonly measure: Measure;
  /**
   * With less room: the two `fold` into the active page, a pager naming
   * both; the book `close`s to it, the other's edge beside it; the second
   * goes `under` the first, the divider measuring by `under`; or the active
   * page shows alone while the other `wait`s, the colophon saying so (and a
   * split asked for without the room is refused, ../vault/note-actions.ts).
   */
  readonly narrow: 'fold' | 'close' | 'under' | 'wait';
  readonly under?: Measure;
  /**
   * A page's own host while split: the commands it holds for its note (out
   * of the layout's), on each page or the second alone, at its head or foot.
   */
  readonly own: {
    readonly items: readonly CommandId[];
    readonly on: 'each' | 'second';
    readonly at: 'head' | 'foot';
  };
  /** Commands that join the layout's page tools while split. */
  readonly tools: readonly CommandId[];
  /** What the layout's tools act on: the active page, or the first page always (the formatting bar still the caret's). */
  readonly toolsFor: 'active' | 'first';
  /**
   * Each note's figures (words, save, last seal): the active note's in the
   * colophon; each at its own page's foot, the colophon keeping the book's;
   * or the second's at its foot, the first's in the colophon.
   */
  readonly figures: 'active' | 'pages' | 'second';
  /** The active page carries a mark (appearance.facingMark): the ribbon, a dog-ear or a tab. */
  readonly mark: boolean;
  /** A note dropped on a lone page past this share of it opens beside it, as the preview says (../vault/page-drop.ts). */
  readonly drop: { readonly past: number; readonly label: string };
  /** The pane's furniture (its bar, formatting bar, colophon) stands over the active page alone, placed by grid. */
  readonly follows: boolean;
  /** The note list steps aside while split, not saved as shut; ⇧⌘\ brings it back. */
  readonly listAside: boolean;
}

const NO_OWN = { items: [], on: 'each', at: 'foot' } as const;

export const SPLIT_SPECS: Readonly<Record<SplitMode, SplitSpec>> = {
  // 3 · Two sheets: one set of tools, for the active page; ⇄ is the divider's.
  sheets: {
    least: 2 * PAGE_MIN,
    measure: SHARE,
    narrow: 'fold',
    own: NO_OWN,
    tools: [],
    toolsFor: 'active',
    figures: 'active',
    mark: false,
    drop: { past: 0.6, label: 'Open to the side' },
    follows: false,
    listAside: false,
  },
  // 4 · Facing pages: the book's tools at the top; each note's own in its folio.
  facing: {
    least: 2 * PAGE_MIN,
    measure: SHARE,
    narrow: 'close',
    own: {
      items: ['compare', 'seal', 'versions', 'copy-html', 'page.close'],
      on: 'each',
      at: 'foot',
    },
    tools: ['pages.swap'],
    toolsFor: 'active',
    figures: 'pages',
    mark: true,
    drop: { past: 0.6, label: 'Open as the facing page' },
    follows: false,
    listAside: false,
  },
  // 5 · Companion: the page keeps every tool; the companion, at the right edge, its own few.
  companion: {
    least: COMPANION.least + COMPANION.page,
    measure: BESIDE,
    narrow: 'under',
    under: UNDER_PAGE,
    own: { items: ['page.lead', 'page.more', 'page.close'], on: 'second', at: 'head' },
    tools: [],
    toolsFor: 'first',
    figures: 'second',
    mark: false,
    drop: { past: 0.7, label: 'Open as the companion' },
    follows: false,
    listAside: false,
  },
  // 6 · Tools that follow: the list steps aside; one set of furniture, over the page you're in.
  follow: {
    least: 2 * PAGE_MIN,
    measure: SHARE,
    narrow: 'wait',
    own: NO_OWN,
    tools: [],
    toolsFor: 'active',
    figures: 'active',
    mark: false,
    drop: { past: 0.6, label: 'Open to the side' },
    follows: true,
    listAside: true,
  },
};

/** `layout`'s hosts as `split` draws them: its pages' own commands taken out, its tools added. */
export function splitHosts(layout: LayoutSpec, split: SplitSpec | null): readonly HostSpec[] {
  if (!split) return layout.desktop;
  const own = new Set<string>(split.own.items);
  return layout.desktop.map((host) => {
    const kept = host.items.filter((item) => typeof item !== 'string' || !own.has(item));
    // A rule left first, last, or beside another separates nothing.
    const items = kept.filter(
      (item, at) => item !== '|' || (at > 0 && at < kept.length - 1 && kept[at - 1] !== '|'),
    );
    return host.name === layout.tools && split.tools.length > 0
      ? { ...host, items: [...items, '|', ...split.tools] }
      : { ...host, items };
  });
}
