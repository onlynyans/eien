// A page's frame in the pane (./page.ts): its scroll, and round it its own
// head and foot, which only some split modes fill (../chrome/splits.ts): a
// companion's head (its name and its few tools), a folio at the foot (its
// figures and its tools). Empty, they take no room (./split.css). And what
// the pane asks of a page whatever it holds (a note, or an EPUB, backlog
// #40), so the split, its pager and the rooms carry a page without asking.

import { h } from '../dom';

/** What a page holds: a note, or an EPUB (../epub/, ../../../docs/page-kinds.md). */
export type PageKind = 'note' | 'epub';

export interface PageLeaf {
  readonly element: HTMLElement;
  /** The page's own head: its note's name, and its own tools. */
  readonly head: { readonly name: HTMLElement; readonly tools: HTMLElement };
  /** The page's own foot: its note's figures, and its own tools. */
  readonly folio: { readonly figures: HTMLElement; readonly tools: HTMLElement };
}

/**
 * A page's own items in the colophon, in its order round the window's (the
 * counters, the zoom, the news): a note's tags lead, its words and save are
 * its figures, its last seal trails the counters. Where the split gives each
 * page its own foot, the figures and the trail go there instead.
 */
export interface LeafFoot {
  readonly lead: HTMLElement;
  readonly figures: readonly HTMLElement[];
  readonly trail: HTMLElement;
  /** What it just did, for a while, last in the colophon. */
  readonly said: HTMLElement;
}

/**
 * Find on a page (the find bar, ../find/find-bar.ts, over what it holds): each
 * does nothing where there's nothing to find in now (a note's outline cards).
 */
export interface PageFind {
  /** Open the bar, Replace unfolded for `replace` where the page's text can change. */
  open(replace: boolean): void;
  next(): void;
  previous(): void;
}

/** What the page pane (./page-pane.ts, ./pages-row.ts) asks of a page, whatever it holds. */
export interface PaneLeaf extends PageLeaf {
  /** The name the pager, the closed book's edge and the page's label call it; '' with nothing open. */
  readonly name: string;
  /** Its crumbs, for a running head across the window (C's): the pane shows the active page's. */
  readonly runningCrumbs: HTMLElement;
  /** Beside the pane, the active page's (a note's versions panel). */
  readonly aside: HTMLElement;
  /** Over the colophon, the active page's (a note's table bar, above a phone's keyboard). */
  readonly under: HTMLElement;
  readonly foot: LeafFoot;
  /** Find on it: the menu's Find, Find and Replace, Find Next and Previous. */
  readonly find: PageFind;
  /** Its controls with tooltips, for the window to watch once (its ×, a note's tags' +). */
  readonly tipped: readonly HTMLElement[];
  /** The keyboard to it; on a touch screen only `typing` brings the phone's keyboard up. */
  focus(typing?: boolean): void;
  /** A key on the pane outside the words and any field (a note's #, its tags). */
  key(event: KeyboardEvent): void;
  /**
   * About to be taken out of the pane and put back (the pages swapped, a
   * page opened beside or closed), which begins its scroll again at the top:
   * `taking` while it's still laid out, `placed` once it's back. An EPUB's
   * keeps its place and shows it again; a note's editor keeps its own.
   */
  taking?(): void;
  placed?(): void;
  /** The page closed: all it holds let go, its parts out of the window. */
  dispose(): void;
}

export function pageLeaf(scroll: HTMLElement): PageLeaf {
  const head = {
    name: h('span', { class: 'page__name' }),
    tools: h('span', { class: 'page__tools' }),
  };
  const folio = {
    figures: h('span', { class: 'page__figures' }),
    tools: h('span', { class: 'page__tools' }),
  };
  const element = h(
    'div',
    { class: 'page__leaf' },
    h('div', { class: 'page__head' }, head.name, head.tools),
    scroll,
    h('footer', { class: 'page__folio count' }, folio.figures, folio.tools),
  );
  return { element, head, folio };
}
