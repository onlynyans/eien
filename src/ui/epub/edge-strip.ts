// The whole book down the page's edge (#40, Phase 4d, epub.md → Marks: On
// the edge; Features 3's thumb strip): a hairline for each chapter (a longer
// one each tenth), each bookmark a pencil tab and each highlight a pencil
// tick (Phase 5b), your place a bar across it.
// Pointing shows where a point is; a click goes there; a finger drags to
// scrub and goes where it's lifted (a tap alone never jumps: a finger
// scrolling or turning may start there). To the keyboard it's a slider: ↑ ↓
// a chapter, Page Up and Down ten, Home and End the book's ends. Shares of
// the book in, shares out: what they are is the caller's (./book-strip.ts).
// Apart from the fore-edge (./leaf-edges.ts), which a spread lays out anew.

import type { Mark } from '../../core/epub';
import { h } from '../dom';

export interface EdgeStripOf {
  /** A point on the strip chosen: that share of the book. */
  go(share: number): void;
  /** The keys: chapters on (back if less than 0), or the book's first or last. */
  step(by: number | 'first' | 'last'): void;
  /** What a share of the book is, as the tip and a screen reader say it ("Chapter III · page 12"). */
  describe(share: number): string;
}

/** What the strip shows, each a share of the book (0 its start, 1 its end). */
export interface StripModel {
  readonly chapters: readonly number[];
  /** Each mark, of its kind: a bookmark a tab, a highlight a pencil tick. */
  readonly marks: readonly { readonly kind: Mark['kind']; readonly share: number }[];
}

/** A share of the book held within it. */
const within = (share: number) => Math.min(1, Math.max(0, Number.isFinite(share) ? share : 0));

/** A piece of the strip at `share` down it: set through the style object, as the window's policy allows. */
function at(className: string, share: number): HTMLElement {
  const piece = h('i', { class: className });
  piece.style.setProperty('--at', String(within(share)));
  return piece;
}

/** Each kind of mark's look on the strip (./edge-strip.css). */
const MARK_CLASS: Readonly<Record<Mark['kind'], string>> = {
  bookmark: 'edge-strip__mark',
  highlight: 'edge-strip__highlight',
};

/** How far a finger moves along the strip before it's a scrub, not a tap: a turn's own threshold. */
const SCRUB_PX = 8;

const KEYS: Readonly<Record<string, number | 'first' | 'last'>> = {
  ArrowUp: -1,
  ArrowDown: 1,
  PageUp: -10,
  PageDown: 10,
  Home: 'first',
  End: 'last',
};

export class EdgeStrip {
  readonly element: HTMLElement;
  readonly #of: EdgeStripOf;
  readonly #marks = h('span', { class: 'edge-strip__marks', attrs: { 'aria-hidden': 'true' } });
  readonly #here = at('edge-strip__here', 0);
  readonly #tip = h('span', {
    class: 'edge-strip__tip',
    attrs: { 'aria-hidden': 'true', hidden: true },
  });
  /** A point held down on the strip, while a hand drags it. */
  #held: number | null = null;
  /** Where a finger came down, until it moves far enough to scrub; null for a pointer that clicks. */
  #finger: number | null = null;

  constructor(of: EdgeStripOf) {
    this.#of = of;
    this.element = h(
      'div',
      {
        class: 'edge-strip',
        attrs: {
          role: 'slider',
          tabindex: '0',
          'aria-label': 'The whole book',
          'aria-orientation': 'vertical',
          'aria-valuemin': '0',
          'aria-valuemax': '100',
          'aria-valuenow': '0',
        },
        on: {
          keydown: (event: KeyboardEvent) => this.#key(event),
          pointerdown: (event: PointerEvent) => this.#down(event),
          pointermove: (event: PointerEvent) => this.#point(event),
          pointerup: (event: PointerEvent) => this.#up(event),
          pointercancel: () => this.#end(),
          lostpointercapture: () => this.#end(),
          pointerleave: () => {
            if (this.#held === null) this.#tip.hidden = true;
          },
        },
      },
      this.#marks,
      this.#here,
      this.#tip,
    );
  }

  /** The book's chapters and marks, drawn anew. */
  draw(model: StripModel): void {
    this.#marks.replaceChildren(
      ...model.chapters.map((share, i) =>
        at(
          i % 10 === 0 ? 'edge-strip__chapter edge-strip__chapter--tenth' : 'edge-strip__chapter',
          share,
        ),
      ),
      ...model.marks.map(({ kind, share }) => at(MARK_CLASS[kind], share)),
    );
  }

  /**
   * The place in the book now, as a share of it and in `words` (its chapter,
   * and its printed page or share of the book): the bar, and what the slider
   * says. Told every scroll frame, so only what changed is set.
   */
  place(share: number, words: string): void {
    const now = String(within(share));
    // Rounded down, as its words are (core/epub/progress.ts percent): never 22 beside "21%".
    const percent = String(Math.floor(within(share) * 100 + 1e-9));
    if (this.#here.style.getPropertyValue('--at') !== now)
      this.#here.style.setProperty('--at', now);
    if (this.element.getAttribute('aria-valuenow') !== percent)
      this.element.setAttribute('aria-valuenow', percent);
    if (this.element.getAttribute('aria-valuetext') !== words)
      this.element.setAttribute('aria-valuetext', words);
  }

  /** The share of the book at a point `y` down the window, by the strip's own box. */
  #shareAt(y: number): number {
    const box = this.element.getBoundingClientRect();
    return box.height > 0 ? within((y - box.top) / box.height) : 0;
  }

  /** The tip beside the point: what's there. */
  #show(share: number): void {
    this.#tip.hidden = false;
    this.#tip.textContent = this.#of.describe(share);
    this.#tip.style.setProperty('--at', String(share));
  }

  #key(event: KeyboardEvent): void {
    const by = KEYS[event.key];
    if (by === undefined || event.altKey || event.metaKey || event.ctrlKey) return;
    // The strip's own: never a page's turn.
    event.preventDefault();
    event.stopPropagation();
    this.#of.step(by);
  }

  #down(event: PointerEvent): void {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    // Held to the strip as the hand drags past it; a pointer the window doesn't know can't be.
    try {
      this.element.setPointerCapture(event.pointerId);
    } catch {}
    this.#held = this.#shareAt(event.clientY);
    this.#finger = event.pointerType === 'touch' ? event.clientY : null;
    this.#show(this.#held);
  }

  #point(event: PointerEvent): void {
    const share = this.#shareAt(event.clientY);
    if (this.#held !== null) this.#held = share;
    if (this.#finger !== null && Math.abs(event.clientY - this.#finger) >= SCRUB_PX)
      this.#finger = null;
    this.#show(share);
  }

  #up(event: PointerEvent): void {
    if (this.#held === null) return;
    event.stopPropagation();
    const share = this.#shareAt(event.clientY);
    // A finger that never moved far enough tapped: it goes nowhere.
    const tapped = this.#finger !== null;
    this.#end();
    if (!tapped) this.#of.go(share);
  }

  #end(): void {
    this.#held = null;
    this.#finger = null;
    this.#tip.hidden = true;
  }
}
