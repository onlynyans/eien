// The divider between two pages (the split, spec §4), drawn as a pane's edge
// is: a hairline in a track of its own with a handle round it, dragged, or
// moved with the arrow keys along it; a double-click or Enter evens it; ⇄ on
// it swaps the pages. What it moves is the mode's measure (two pages' share,
// a companion's width or height), each remembered on this device; the
// arithmetic is ../shell/split-state.ts.

import { h } from '../dom';
import { quietButton } from '../quiet-button';
import { STEP } from '../shell/pane-state';
import type { Measure } from '../shell/split-state';

export interface DividerEvents {
  /** The room it divides now, in pixels, along its measure's axis. */
  room(): number;
  /** It moved: the pages are laid out again. */
  moved(): void;
  swap(): void;
}

/** The arrow keys that move it, along each axis: back, then on. */
const KEYS = { x: ['ArrowLeft', 'ArrowRight'], y: ['ArrowUp', 'ArrowDown'] } as const;

export class Divider {
  /** Its track between the pages: the handle, and ⇄ beside it (never inside it, a control in a control). */
  readonly element: HTMLElement;
  /** The separator itself: dragged, moved with the keys, named for assistive tech. */
  readonly handle: HTMLElement;
  readonly #events: DividerEvents;
  #measure: Measure | null = null;
  #value = 0;

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
        'aria-label': 'Between the two pages',
        'aria-valuemin': '0',
        'aria-valuemax': '100',
        'data-tip': 'Drag to resize · double-click to even',
      },
      on: {
        pointerdown: (down) => this.#drag(down),
        dblclick: () => {
          if (this.#measure) this.#set(this.#measure.even);
        },
        keydown: (event) => this.#key(event),
      },
    });
    this.element = h('div', { class: 'divider quiet-row' }, this.handle, swap);
  }

  /** Measure by `measure` (the mode's): what was kept for it on this device, read once. */
  use(measure: Measure): void {
    if (measure === this.#measure) return;
    this.#measure = measure;
    this.#value = measure.read(stored(measure.key));
    const [back, on] = KEYS[measure.axis];
    this.handle.setAttribute('aria-orientation', measure.axis === 'x' ? 'vertical' : 'horizontal');
    this.handle.setAttribute('aria-keyshortcuts', `${back} ${on} Enter`);
    this.element.dataset.axis = measure.axis;
  }

  /** The share of a room `room` wide (or high) before the divider, as it's shown there. */
  shown(room: number): number {
    const share = this.#measure ? this.#measure.shown(this.#value, room) : 0.5;
    this.handle.setAttribute('aria-valuenow', String(Math.round(share * 100)));
    return share;
  }

  #set(value: number, save = true): void {
    this.#value = value;
    this.#events.moved();
    if (save && this.#measure) keep(this.#measure.key, value);
  }

  #drag(down: PointerEvent): void {
    const measure = this.#measure;
    if (!measure || down.button !== 0) return;
    down.preventDefault(); // no text chosen on the way
    const along = (event: PointerEvent) => (measure.axis === 'x' ? event.clientX : event.clientY);
    const from = { at: along(down), value: this.#value, room: this.#events.room() };
    const to = (event: PointerEvent) =>
      measure.moved(from.value, from.room, along(event) - from.at);
    this.handle.classList.add('is-dragging');
    // Followed on the document, as a pane's edge is (../shell/panes.ts): the divider moving out
    // from under the pointer doesn't end it. A move with the button up was let go elsewhere.
    const move = (event: PointerEvent) => {
      if ((event.buttons & 1) === 0) end();
      else this.#set(to(event), false);
    };
    const up = (event: PointerEvent) => {
      this.#set(to(event), false);
      end();
    };
    const end = () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      document.removeEventListener('pointercancel', end);
      this.handle.classList.remove('is-dragging');
      keep(measure.key, this.#value);
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
    document.addEventListener('pointercancel', end);
  }

  #key(event: KeyboardEvent): void {
    const measure = this.#measure;
    if (!measure || event.target !== this.handle) return;
    if (event.altKey || event.metaKey || event.ctrlKey) return;
    const [back, on] = KEYS[measure.axis];
    const by = event.key === back ? -STEP : event.key === on ? STEP : 0;
    if (by !== 0) this.#set(measure.moved(this.#value, this.#events.room(), by));
    else if (event.key === 'Enter') this.#set(measure.even);
    else return;
    event.preventDefault();
  }
}

function stored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function keep(key: string, value: number): void {
  try {
    localStorage.setItem(key, JSON.stringify({ value }));
  } catch {
    // Storage refused: the divider holds until the window closes.
  }
}
