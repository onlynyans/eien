// The split's modes (spec §4, Split; the setting appearance.split), each a
// spec as each layout is (./layouts.ts): what a pane too narrow for two
// pages does, which commands move from the layout's hosts onto each page
// while split (its own host, at its foot), which join the page's tools, and
// where each note's words and seal go. With one page, every mode is the
// layout as it is.

import type { SettingValues } from '../../core/config';
import type { CommandId } from './commands';
import type { HostSpec, LayoutSpec } from './layout-spec';

export type SplitMode = SettingValues['appearance.split'];

export interface SplitSpec {
  /**
   * Too narrow for two pages: they `fold` into the active one, a pager
   * naming both; or the book `close`s to the active one, the other's edge
   * beside it to turn to.
   */
  readonly narrow: 'fold' | 'close';
  /** Each page's own host while split: the commands it holds for its note, out of the layout's. */
  readonly own: readonly CommandId[];
  /** Commands that join the layout's page tools while split. */
  readonly tools: readonly CommandId[];
  /** Each note's words, save and seal while split: the pane's colophon (the active one's), or its own page's foot. */
  readonly foot: 'colophon' | 'page';
  /** The active page carries a mark (appearance.facingMark): the ribbon, a dog-ear or a tab. */
  readonly mark: boolean;
}

export const SPLIT_SPECS: Readonly<Record<SplitMode, SplitSpec>> = {
  // 3 · Two sheets: one set of tools, for the active page; ⇄ is the divider's.
  sheets: { narrow: 'fold', own: [], tools: [], foot: 'colophon', mark: false },
  // 4 · Facing pages: the book's tools at the top; each note's own in its folio.
  facing: {
    narrow: 'close',
    own: ['compare', 'seal', 'versions', 'copy-html', 'page.close'],
    tools: ['pages.swap'],
    foot: 'page',
    mark: true,
  },
};

/** `layout`'s hosts as `split` draws them: its own commands taken out, its tools added. */
export function splitHosts(layout: LayoutSpec, split: SplitSpec | null): readonly HostSpec[] {
  if (!split) return layout.desktop;
  const own = new Set<string>(split.own);
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
