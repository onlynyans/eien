// The three panes side by side (spec §4). A pane's edge is dragged, or
// stepped with the arrow keys once it has the keyboard; the sidebar and the
// note list shut and open again (⌘\, ⌘⇧\, the layout's chevrons or running
// head (../chrome), the seal).
// With two panes the list is gone and the sidebar's tree holds the notes; so
// while a split with Tools that follow has the list step aside, not saved as
// shut, until it's brought back; and a phone's Panes too narrow for three
// shows two, until it's wider (#68).
// Widths and what's shut are remembered on this device (./pane-state.ts).

import type { PhonePane } from '../phone/room';
import { type EdgeFrom, type EdgeOf, paneEdge } from './pane-edge';
import {
  besideWidth,
  dragged,
  type Edge,
  LIMITS,
  type Panes,
  readPanes,
  shownWidths,
  sidebarEdge,
  THREE_LEAST,
} from './pane-state';

const KEY = 'eien.panes';

/** The panes that shut: the sidebar, and the note list. */
export type Shuttable = 'sidebar' | 'list';

export interface PaneParts {
  readonly shell: HTMLElement;
  readonly sidebar: HTMLElement;
  readonly list: HTMLElement;
  /** Where the keyboard goes when `pane`, which had it, shuts: the pane keeps the row it was on. */
  leave(pane: Shuttable): void;
  /** A pane shut or opened, or the panes changed from three to two. */
  changed(): void;
  /** The phone's way, the pane the writer is at (../phone/phone-stack.ts); null with the desktop's panes. */
  phone(): PhonePane | null;
  /** The phone's way, whether `pane` is in sight (the pane before may be, beside it). */
  inSight(pane: PhonePane): boolean;
  /** Side by side, the pane kept in sight beside the one you're in, its edge dragged; else null. */
  beside(): Shuttable | null;
  /** The phone's way, bring a pane into sight. */
  showPhone(pane: PhonePane): void;
}

/** The keys that shut and open each pane (../../app/electron/menu.ts), as this system writes them. */
export const paneKeys = (mac: boolean): Readonly<Record<Shuttable, string>> =>
  mac ? { sidebar: '⌘\\', list: '⇧⌘\\' } : { sidebar: 'Ctrl+\\', list: 'Ctrl+Shift+\\' };

export class PaneLayout {
  readonly #parts: PaneParts;
  readonly #edges: Record<Shuttable, HTMLElement>;
  #panes: Panes;
  #two: boolean;
  /** A phone's build: its Panes show two where three don't fit (./pane-state.ts, THREE_LEAST). */
  readonly #crowds: boolean;
  /** Whether the panes were last laid out as two: crowding follows the window's width live. */
  #laidTwo = false;
  /** The list stepped aside for a split (Tools that follow): out of sight, never saved as shut. */
  #aside = false;
  /** What the split last asked: a list brought back stays back until the split asks again. */
  #asideAsked = false;
  readonly #onResize = () => this.#fit();

  constructor(parts: PaneParts, two: boolean, crowds = false) {
    this.#parts = parts;
    this.#two = two;
    this.#crowds = crowds;
    this.#panes = readPanes(stored());
    const edgeOf = (pane: Shuttable): EdgeOf => ({
      shell: parts.shell,
      width: () => this.#shown()[pane],
      panes: () => this.#panes,
      move: (from, by) => this.#move(pane, from, by),
      save: () => this.#save(),
    });
    this.#edges = {
      sidebar: paneEdge('sidebar', edgeOf('sidebar')),
      list: paneEdge('list', edgeOf('list')),
    };
    parts.shell.append(this.#edges.sidebar, this.#edges.list);
    window.addEventListener('resize', this.#onResize);
    this.#apply();
  }

  /** Two panes (or the list stepped aside): the tree lists the notes. Never on a phone, one pane at a time. */
  get two(): boolean {
    return this.#listGone() && !this.#parts.phone();
  }

  /** Three panes chosen, and two shown: a phone's Panes with no room for three. */
  get crowded(): boolean {
    return this.#crowds && !this.#two && !this.#parts.phone() && innerWidth < THREE_LEAST;
  }

  /** The note list's width on screen: none while it's out of sight. */
  get listWidth(): number {
    return this.isShut('list') ? 0 : this.#shown().list;
  }

  /** Whether the list has stepped aside for a split, to be brought back by its toggle. */
  get aside(): boolean {
    return this.#aside && !this.#parts.phone();
  }

  /** Whether this is a phone's layout, one pane at a time. */
  get phone(): boolean {
    return this.#parts.phone() !== null;
  }

  /** Whether `pane` is out of sight: shut, or, for the list, there are two panes; the phone's way, not in sight. */
  isShut(pane: Shuttable): boolean {
    if (this.#parts.phone()) return !this.#parts.inSight(pane);
    return pane === 'list' ? this.#listGone() || this.#panes.listShut : this.#panes.sidebarShut;
  }

  /** Shut `pane` if it's open, open it if it's shut. The list has nothing to do with two panes. */
  toggle(pane: Shuttable): void {
    const phone = this.#parts.phone();
    // The phone's way, "Hide sidebar" (the tree's seal) goes on a step: to the notes, or past them to the page.
    if (phone && pane === 'sidebar' && this.#parts.inSight('sidebar'))
      this.#parts.showPhone(this.#parts.inSight('list') ? 'page' : 'list');
    else if (!phone && pane === 'list' && this.#aside) this.#stepBack();
    else if (!phone && !(pane === 'list' && this.two)) this.#set(pane, !this.isShut(pane));
  }

  /** Whether the list is drawn: in sight, or on a phone, a pane away (its back bar names it). */
  get listKept(): boolean {
    return !this.isShut('list') || this.#parts.phone() !== null;
  }

  /** Open `pane` if it's shut (on a phone, bring it into sight); whether it's in sight now. */
  open(pane: Shuttable): boolean {
    if (this.#parts.phone()) {
      this.#parts.showPhone(pane);
      return true;
    }
    if (pane === 'list' && this.#aside) this.#stepBack();
    if (pane === 'list' && this.two) return false;
    if (this.isShut(pane)) this.#set(pane, false);
    return true;
  }

  /** On a phone, bring the page into sight; elsewhere it always is. */
  openPage(): void {
    if (this.#parts.phone()) this.#parts.showPhone('page');
  }

  /** Fit the panes again: a shut sidebar's strip may have changed (the layout, or Shut sidebar). */
  refit(): void {
    this.#apply();
  }

  /** Lay the panes out again, and draw them: the window became a phone's, or the pane shown changed. */
  relayout(): void {
    this.#relay(() => this.#apply(), true);
  }

  setTwo(two: boolean): void {
    if (two === this.#two) return;
    this.#relay(() => {
      this.#two = two;
      this.#apply();
    }, true);
  }

  /** A split with Tools that follow begins (true) or ends (false): the list steps aside, or back. */
  stepAside(on: boolean): void {
    if (on === this.#asideAsked) return;
    this.#asideAsked = on;
    if (on === this.#aside) return;
    this.#relay(() => {
      this.#aside = on;
      this.#apply();
    }, true);
  }

  stop(): void {
    window.removeEventListener('resize', this.#onResize);
  }

  /** The list brought back from aside, the split going on. */
  #stepBack(): void {
    this.#aside = false;
    this.#apply();
    this.#parts.changed();
  }

  /** The list gone, its notes in the tree: two panes, stepped aside for a split, or crowded. */
  #listGone(): boolean {
    return this.#two || this.#aside || this.crowded;
  }

  /**
   * Lay the panes out as `change` does, and draw them again (`always`, or with three changed to
   * two or back); the list gone with the keyboard in it, the keyboard goes on.
   */
  #relay(change: () => void, always: boolean): void {
    const was = this.#laidTwo;
    const hadFocus = this.#holds('list');
    change();
    if (this.two && hadFocus) this.#parts.leave('list');
    if (always || this.two !== was) this.#parts.changed();
  }

  /** Whether the keyboard is in `pane`, or on its edge. */
  #holds(pane: Shuttable): boolean {
    const active = document.activeElement;
    const element = pane === 'sidebar' ? this.#parts.sidebar : this.#parts.list;
    return element.contains(active) || this.#edges[pane] === active;
  }

  #set(pane: Shuttable, shut: boolean): void {
    const hadFocus = this.#holds(pane);
    this.#panes = { ...this.#panes, [pane === 'sidebar' ? 'sidebarShut' : 'listShut']: shut };
    this.#apply();
    this.#save();
    // A shut pane can't keep the keyboard: it goes to the page, never to nowhere.
    if (shut && hadFocus) this.#parts.leave(pane);
    this.#parts.changed();
  }

  /**
   * Fit the panes to the window as it's resized, at once: the slide is for a pane opening or
   * shutting. Slid, a pane squeezed by a narrower window would trail it by a step each frame,
   * and everything after it, the page's bar too, jump about as it caught up (#44).
   */
  #fit(): void {
    const { shell } = this.#parts;
    this.#relay(() => {
      shell.classList.add('is-fitting');
      this.#apply();
      // The new widths are styled while nothing slides; taken off after, they're already there.
      void getComputedStyle(shell).gridTemplateColumns;
      shell.classList.remove('is-fitting');
    }, false);
  }

  #apply(): void {
    const { shell, list } = this.#parts;
    const shown = this.#shown();
    // Through the style API: the security policy refuses style attributes.
    shell.style.setProperty('--pane-sidebar', `${shown.sidebar}px`);
    shell.style.setProperty('--pane-list', `${shown.list}px`);
    this.#laidTwo = this.two;
    shell.dataset.panes = this.#laidTwo ? 'two' : 'three';
    shell.toggleAttribute('data-sidebar-shut', this.isShut('sidebar'));
    shell.toggleAttribute('data-list-shut', this.isShut('list'));
    list.inert = this.isShut('list');
    for (const pane of ['sidebar', 'list'] as const) {
      const [min, max] = LIMITS[this.#edgeOf(pane)];
      const edge = this.#edges[pane];
      edge.setAttribute('aria-valuenow', String(shown[pane]));
      edge.setAttribute('aria-valuemin', String(min));
      edge.setAttribute('aria-valuemax', String(max));
    }
  }

  /**
   * The widths on screen: a shut sidebar is as wide as the layout makes its strip (--strip,
   * ./shell.css); side by side, the pane beside the page as the writer left it (./pane-state.ts).
   */
  #shown(): ReturnType<typeof shownWidths> {
    const strip = getComputedStyle(this.#parts.shell).getPropertyValue('--strip');
    const shown = shownWidths(this.#panes, this.two, window.innerWidth, Number.parseFloat(strip));
    const beside = this.#parts.beside();
    return beside
      ? { ...shown, [beside]: besideWidth(this.#panes, beside, window.innerWidth) }
      : shown;
  }

  #edgeOf(pane: Shuttable): Edge {
    return pane === 'sidebar' ? sidebarEdge(this.two) : 'list';
  }

  /** Move `pane`'s edge `by` pixels from `shown`, its width on screen when the move began. */
  #move(pane: Shuttable, from: EdgeFrom, by: number): void {
    this.#panes = dragged(from.panes, this.#edgeOf(pane), from.shown, by);
    this.#apply();
  }

  #save(): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.#panes));
    } catch {
      // Storage refused: the panes hold until the window closes.
    }
  }
}

function stored(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}
