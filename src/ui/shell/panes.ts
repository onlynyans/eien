// The three panes side by side (spec §4). A pane's edge is dragged, or
// stepped with the arrow keys once it has the keyboard; the sidebar and the
// note list shut and open again (⌘\, ⌘⇧\, the page bar's words, the seal).
// With two panes the list is gone and the sidebar's tree holds the notes.
// Widths and what's shut are remembered on this device (./pane-state.ts).

import { h } from '../dom';
import type { PhonePane } from '../phone/phone-stack';
import {
  dragged,
  type Edge,
  LIMITS,
  type Panes,
  readPanes,
  STEP,
  shownWidths,
  sidebarEdge,
} from './pane-state';

const KEY = 'eien.panes';

/** The panes that shut: the sidebar, and the note list. */
export type Shuttable = 'sidebar' | 'list';

export interface PaneParts {
  readonly shell: HTMLElement;
  readonly sidebar: HTMLElement;
  readonly list: HTMLElement;
  /** The keys that shut each pane, as the menu shows them. */
  readonly keys: Readonly<Record<Shuttable, string>>;
  /** Where the keyboard goes when the pane it was in shuts. */
  leave(): void;
  /** A pane shut or opened, or the panes changed from three to two. */
  changed(): void;
  /** On a phone, the one pane in sight (../phone/phone-stack.ts); null on a wider window. */
  phone(): PhonePane | null;
  /** On a phone, bring a pane into sight. */
  showPhone(pane: PhonePane): void;
}

const NAMES: Record<Shuttable, string> = { sidebar: 'Sidebar', list: 'List' };

/** The keys that shut and open each pane (../../app/electron/menu.ts), as this system writes them. */
export const paneKeys = (mac: boolean): Readonly<Record<Shuttable, string>> =>
  mac ? { sidebar: '⌘\\', list: '⇧⌘\\' } : { sidebar: 'Ctrl+\\', list: 'Ctrl+Shift+\\' };

export class PaneLayout {
  /** SIDEBAR and LIST, for the start of the page's bar. */
  readonly controls: HTMLElement;
  readonly #parts: PaneParts;
  readonly #edges: Record<Shuttable, HTMLElement>;
  readonly #buttons: Record<Shuttable, HTMLButtonElement>;
  #panes: Panes;
  #two: boolean;
  readonly #onResize = () => this.#apply();

  constructor(parts: PaneParts, two: boolean) {
    this.#parts = parts;
    this.#two = two;
    this.#panes = readPanes(stored());
    this.#edges = { sidebar: this.#edge('sidebar'), list: this.#edge('list') };
    this.#buttons = { sidebar: this.#button('sidebar'), list: this.#button('list') };
    this.controls = h(
      'div',
      { class: 'page__panes', attrs: { role: 'group', 'aria-label': 'Panes' } },
      this.#buttons.sidebar,
      this.#buttons.list,
    );
    parts.shell.append(this.#edges.sidebar, this.#edges.list);
    window.addEventListener('resize', this.#onResize);
    this.#apply();
  }

  /** Two panes: the tree lists the notes. Never on a phone, which shows one pane at a time. */
  get two(): boolean {
    return this.#two && !this.#parts.phone();
  }

  /** Whether `pane` is out of sight: shut, or, for the list, there are two panes; on a phone, not the one shown. */
  isShut(pane: Shuttable): boolean {
    const phone = this.#parts.phone();
    if (phone) return phone !== pane;
    return pane === 'list' ? this.#two || this.#panes.listShut : this.#panes.sidebarShut;
  }

  /** Shut `pane` if it's open, open it if it's shut. The list has nothing to do with two panes. */
  toggle(pane: Shuttable): void {
    const phone = this.#parts.phone();
    // On a phone, "Hide sidebar" (the tree's seal) goes on to the notes.
    if (phone === 'sidebar' && pane === 'sidebar') this.#parts.showPhone('list');
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
    if (pane === 'list' && this.two) return false;
    if (this.isShut(pane)) this.#set(pane, false);
    return true;
  }

  /** On a phone, bring the page into sight; elsewhere it always is. */
  openPage(): void {
    if (this.#parts.phone()) this.#parts.showPhone('page');
  }

  /** Lay the panes out again, and draw them: the window became a phone's, or the pane shown changed. */
  relayout(): void {
    this.#apply();
    this.#parts.changed();
  }

  setTwo(two: boolean): void {
    if (two === this.#two) return;
    const hadFocus = this.#holds('list');
    this.#two = two;
    this.#apply();
    if (two && hadFocus) this.#parts.leave(); // the list is gone, with the keyboard in it
    this.#parts.changed();
  }

  stop(): void {
    window.removeEventListener('resize', this.#onResize);
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
    if (shut && hadFocus) this.#parts.leave();
    this.#parts.changed();
  }

  #apply(): void {
    const { shell, list } = this.#parts;
    const shown = shownWidths(this.#panes, this.two, window.innerWidth);
    // Through the style API: the security policy refuses style attributes.
    shell.style.setProperty('--pane-sidebar', `${shown.sidebar}px`);
    shell.style.setProperty('--pane-list', `${shown.list}px`);
    shell.dataset.panes = this.two ? 'two' : 'three';
    shell.toggleAttribute('data-sidebar-shut', this.isShut('sidebar'));
    shell.toggleAttribute('data-list-shut', this.isShut('list'));
    list.inert = this.isShut('list');
    for (const pane of ['sidebar', 'list'] as const) {
      const [min, max] = LIMITS[this.#edgeOf(pane)];
      const edge = this.#edges[pane];
      edge.setAttribute('aria-valuenow', String(shown[pane]));
      edge.setAttribute('aria-valuemin', String(min));
      edge.setAttribute('aria-valuemax', String(max));
      const button = this.#buttons[pane];
      const prefix = button.querySelector('.when-wide');
      if (prefix) prefix.textContent = this.isShut(pane) ? 'Show ' : 'Hide ';
    }
    const listButton = this.#buttons.list;
    listButton.disabled = this.two;
    listButton.title = this.two ? 'Two panes: the sidebar lists the notes' : this.#parts.keys.list;
  }

  #edgeOf(pane: Shuttable): Edge {
    return pane === 'sidebar' ? sidebarEdge(this.two) : 'list';
  }

  /** Move `pane`'s edge `by` pixels from `shown`, its width on screen when the move began. */
  #move(
    pane: Shuttable,
    from: { readonly panes: Panes; readonly shown: number },
    by: number,
  ): void {
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

  /** A pane's edge: a hairline that darkens under the pointer, dragged or stepped with ← →. */
  #edge(pane: Shuttable): HTMLElement {
    const edge = h('div', {
      class: `pane-edge pane-edge--${pane}`,
      attrs: {
        role: 'separator',
        tabindex: '0',
        'aria-orientation': 'vertical',
        'aria-label': pane === 'sidebar' ? 'Sidebar width' : 'Note list width',
      },
    });
    const width = () => shownWidths(this.#panes, this.two, window.innerWidth)[pane];
    edge.addEventListener('pointerdown', (down) => {
      if (down.button !== 0) return;
      down.preventDefault(); // no text selected on the way
      const from = { x: down.clientX, panes: this.#panes, shown: width() };
      this.#parts.shell.classList.add('is-resizing');
      edge.classList.add('is-dragging');
      // Followed on the document, as a note's drag is (../list/drag.ts): the edge moving out
      // from under the pointer, or its capture lost to another window, doesn't end it.
      // A move with the button up was let go where the window didn't hear it.
      const move = (event: PointerEvent) => {
        if ((event.buttons & 1) === 0) end();
        else this.#move(pane, from, event.clientX - from.x);
      };
      // Let go: where it was let go counts, though its last move may have come only with the release.
      const up = (event: PointerEvent) => {
        this.#move(pane, from, event.clientX - from.x);
        end();
      };
      const end = () => {
        document.removeEventListener('pointermove', move);
        document.removeEventListener('pointerup', up);
        document.removeEventListener('pointercancel', end);
        this.#parts.shell.classList.remove('is-resizing');
        edge.classList.remove('is-dragging');
        this.#save();
      };
      document.addEventListener('pointermove', move);
      document.addEventListener('pointerup', up);
      document.addEventListener('pointercancel', end);
    });
    edge.addEventListener('keydown', (event) => {
      const by = event.key === 'ArrowLeft' ? -STEP : event.key === 'ArrowRight' ? STEP : 0;
      if (by === 0 || event.altKey || event.metaKey || event.ctrlKey) return;
      event.preventDefault();
      this.#move(pane, { panes: this.#panes, shown: width() }, by);
      this.#save();
    });
    return edge;
  }

  /** HIDE SIDEBAR, SHOW LIST…: the verb drops when the page is narrow. */
  #button(pane: Shuttable): HTMLButtonElement {
    return h(
      'button',
      {
        class: 'word-button',
        attrs: { type: 'button', title: this.#parts.keys[pane], 'data-pane': pane },
        on: { click: () => this.toggle(pane) },
      },
      h('span', { class: 'when-wide' }),
      NAMES[pane],
    );
  }
}

function stored(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}
