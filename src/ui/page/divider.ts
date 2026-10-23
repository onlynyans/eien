// The divider between two pages (the split, spec §4), drawn as a pane's edge
// is: a hairline in a column of its own with a handle round it, dragged, or
// moved with ← →; a double-click or Enter evens the pages; ⇄ on it swaps
// them. Where it stands is remembered on this device; the arithmetic is
// ../shell/split-state.ts.

import { h } from '../dom';
import { quietButton } from '../quiet-button';
import { STEP } from '../shell/pane-state';
import { EVEN, movedShare, readShare, shownShare } from '../shell/split-state';

const KEY = 'eien.split';

export interface DividerEvents {
  /** The page pane's width now, in which the share is shown. */
  width(): number;
  /** It moved: the pages are laid out again. */
  moved(): void;
  swap(): void;
}

export class Divider {
  /** Its column between the pages: the handle, and ⇄ beside it (never inside it, a control in a control). */
  readonly element: HTMLElement;
  /** The separator itself: dragged, moved with the keys, named for assistive tech. */
  readonly handle: HTMLElement;
  #share = readShare(stored());
  readonly #events: DividerEvents;

  constructor(events: DividerEvents) {
    this.#events = events;
    const swap = quietButton({
      label: 'Swap the pages',
      icon: 'swap',
      class: 'divider__swap',
      run: () => events.swap(),
    });
    this.handle = h('div', {
      class: 'divider__handle',
      attrs: {
        role: 'separator',
        tabindex: '0',
        'aria-orientation': 'vertical',
        'aria-label': 'Between the two pages',
        'aria-valuemin': '0',
        'aria-valuemax': '100',
        'aria-keyshortcuts': 'ArrowLeft ArrowRight Enter',
        'data-tip': 'Drag to resize · double-click to even',
      },
      on: {
        pointerdown: (down) => this.#drag(down),
        dblclick: () => this.#set(EVEN),
        keydown: (event) => this.#key(event),
      },
    });
    this.element = h('div', { class: 'divider quiet-row' }, this.handle, swap);
  }

  /** The left page's share of a pane `width` wide, as it's shown there. */
  shown(width: number): number {
    const share = shownShare(this.#share, width);
    this.handle.setAttribute('aria-valuenow', String(Math.round(share * 100)));
    return share;
  }

  #set(share: number, save = true): void {
    this.#share = share;
    this.#events.moved();
    if (save) keep(share);
  }

  #drag(down: PointerEvent): void {
    if (down.button !== 0) return;
    down.preventDefault(); // no text chosen on the way
    const from = { x: down.clientX, share: this.#share, width: this.#events.width() };
    this.handle.classList.add('is-dragging');
    // Followed on the document, as a pane's edge is (../shell/panes.ts): the divider moving out
    // from under the pointer doesn't end it. A move with the button up was let go elsewhere.
    const move = (event: PointerEvent) => {
      if ((event.buttons & 1) === 0) end();
      else this.#set(movedShare(from.share, from.width, event.clientX - from.x), false);
    };
    const up = (event: PointerEvent) => {
      this.#set(movedShare(from.share, from.width, event.clientX - from.x), false);
      end();
    };
    const end = () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      document.removeEventListener('pointercancel', end);
      this.handle.classList.remove('is-dragging');
      keep(this.#share);
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
    document.addEventListener('pointercancel', end);
  }

  #key(event: KeyboardEvent): void {
    if (event.target !== this.handle || event.altKey || event.metaKey || event.ctrlKey) return;
    const by = event.key === 'ArrowLeft' ? -STEP : event.key === 'ArrowRight' ? STEP : 0;
    if (by !== 0) this.#set(movedShare(this.#share, this.#events.width(), by));
    else if (event.key === 'Enter') this.#set(EVEN);
    else return;
    event.preventDefault();
  }
}

function stored(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function keep(share: number): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ share }));
  } catch {
    // Storage refused: the divider holds until the window closes.
  }
}
