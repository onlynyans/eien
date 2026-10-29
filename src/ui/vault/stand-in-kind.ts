// For the window's tests only (nothing the app ships imports it): a second kind of page (./page-side.ts), standing
// in for the EPUB's until it's built (backlog #40), so the tests show the
// split, its pager, swap, ⇄ and the rooms carrying a page whatever it holds.
// It holds `*.stand` files: its name is the file's, its colophon figure says
// which leaf it's at, and its place is that leaf. Its kind's upkeep is told
// to each of its pages (`told`), so a test sees which pages each kind was given.

import type { SettingValues } from '../../core/config';
import { baseName } from '../../core/paths';
import { h } from '../dom';
import { type PaneLeaf, pageLeaf } from '../page/page-leaf';
import { quietButton } from '../quiet-button';
import type { PageKindOf, Place, Side } from './page-side';

/** Where a stand-in page was: the leaf it was at. */
export interface StandInPlace extends Place {
  readonly leaf: number;
}

/** A stand-in page: what it was told, for the tests to look at. */
export interface StandInSide extends Side {
  /** The leaf it's at: a test turns it. */
  leaf: number;
  readonly followed: SettingValues[];
  /** The kind's upkeep this page was given to, in order: 'flush', 'diskChanged', 'followMoves', 'sync', 'stop'. */
  readonly told: string[];
  /** What its find was asked, in order: 'open', 'replace', 'next', 'previous'. */
  readonly finds: string[];
  readonly disposed: boolean;
}

/** Each of `sides` told `what`. */
const tell = (sides: readonly Side[], what: string) => {
  for (const side of sides) (side as StandInSide).told.push(what);
};

export const standInKind: PageKindOf = {
  kind: 'epub',
  holds: (path) => path.endsWith('.stand'),
  make: (hooks, left) => standIn(hooks.close, left),
  flush: async (sides) => tell(sides, 'flush'),
  diskChanged: (_changed, sides) => tell(sides, 'diskChanged'),
  followMoves: (sides) => tell(sides, 'followMoves'),
  sync: (sides) => tell(sides, 'sync'),
  stop: (sides) => tell(sides, 'stop'),
};

function standIn(close: () => void, left: Place | null): StandInSide {
  const scroll = h('div', { class: 'page__scroll' });
  const leaf = pageLeaf(scroll);
  const figure = h('span', { class: 'colophon__leaf' });
  const closer = quietButton({
    label: 'Close this page',
    icon: 'close',
    class: 'sheet__close',
    run: close,
  });
  scroll.append(closer);
  let path: string | null = null;
  let disposed = false;
  let before = left;
  const followed: SettingValues[] = [];
  const finds: string[] = [];
  const page: PaneLeaf = {
    ...leaf,
    get name() {
      return path ? baseName(path).replace(/\.stand$/, '') : '';
    },
    runningCrumbs: h('p', { class: 'label running-crumbs' }),
    aside: h('div', { class: 'page__aside' }),
    under: h('div', { class: 'stand-in__under' }),
    foot: {
      lead: h('span'),
      figures: [figure],
      trail: h('span'),
      said: h('span', { class: 'colophon__said' }),
    },
    find: {
      open: (replace) => void finds.push(replace ? 'replace' : 'open'),
      next: () => void finds.push('next'),
      previous: () => void finds.push('previous'),
    },
    tipped: [closer],
    focus: () => scroll.focus(),
    key: () => {},
    dispose() {
      for (const part of [leaf.element, page.aside, page.under, page.runningCrumbs]) part.remove();
    },
  };
  scroll.tabIndex = -1;
  const side: StandInSide = {
    kind: 'epub',
    page,
    leaf: 0,
    followed,
    told: [],
    finds,
    get disposed() {
      return disposed;
    },
    get path() {
      return path;
    },
    get place() {
      return path ? ({ path, name: page.name, leaf: side.leaf } satisfies StandInPlace) : null;
    },
    get left() {
      return before;
    },
    async open(next, place) {
      if (disposed) return;
      if (path && path !== next) before = side.place;
      path = next;
      side.leaf = place?.path === next && 'leaf' in place ? (place as StandInPlace).leaf : 0;
      figure.textContent = `Leaf ${side.leaf}`;
    },
    clear() {
      path = null;
      figure.textContent = '';
    },
    follow: (values) => void followed.push(values),
    dispose() {
      disposed = true;
      page.dispose();
    },
  };
  return side;
}
