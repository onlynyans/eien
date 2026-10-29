// The selection bar over a book (#40, Phase 2c; spec §4's selection bar,
// its look and its place): a selection in the chapter, left still, shows
// Quote in the note and Copy just above it, as words. It never shows while
// the pointer is down, and goes on Esc, a scroll, or the selection gone.
// Not on a touch screen, where the system's own callout is over the words:
// there the page's ⋯ offers Quote. The selection last made is kept, so a
// tap elsewhere that drops it still quotes it.

import { h } from '../dom';
import { placeBar } from '../editor/selection-bar';
import { touch } from '../menu/menu';

const SHOW_AFTER_MS = 250;

export interface BookSelectionOf {
  readonly chapter: HTMLElement;
  readonly scroller: HTMLElement;
  /** Quote the selection in the note beside. */
  quote(): void;
}

export class BookSelection {
  readonly element: HTMLElement;
  readonly #of: BookSelectionOf;
  #timer: ReturnType<typeof setTimeout> | undefined;
  #range: Range | null = null;

  constructor(of: BookSelectionOf) {
    this.#of = of;
    const button = (text: string, keys: string, run: () => void) =>
      h('button', {
        class: 'word-button',
        text,
        attrs: { type: 'button', 'aria-keyshortcuts': keys },
        on: {
          // The selection stays while a choice is pressed.
          mousedown: (event) => event.preventDefault(),
          click: () => {
            run();
            this.hide();
          },
        },
      });
    this.element = h(
      'div',
      {
        class: 'selection-bar',
        attrs: { role: 'toolbar', 'aria-label': 'The selection', hidden: true },
      },
      button('Quote in the note', 'Q', () => of.quote()),
      // The page's own copy (./book-words.ts) gives the words alone.
      button('Copy', 'Meta+C', () => document.execCommand('copy')),
    );
    document.body.append(this.element);
    of.chapter.addEventListener('mouseup', () => this.#later());
    of.chapter.addEventListener('keyup', (event) => {
      if (event.shiftKey || event.key === 'Shift') this.#later();
    });
    of.chapter.addEventListener('mousedown', () => this.hide());
    of.scroller.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') this.hide();
    });
    of.scroller.addEventListener('scroll', () => this.hide(), { passive: true });
    document.addEventListener('selectionchange', this.#changed);
  }

  /** The selection in the chapter, or the last one made there while it's still drawn; null for none. */
  get range(): Range | null {
    const now = this.#inChapter();
    if (now) return now;
    const kept = this.#range;
    return kept && this.#of.chapter.contains(kept.commonAncestorContainer) ? kept : null;
  }

  hide(): void {
    clearTimeout(this.#timer);
    this.element.hidden = true;
  }

  remove(): void {
    this.hide();
    document.removeEventListener('selectionchange', this.#changed);
    this.element.remove();
  }

  #inChapter(): Range | null {
    const selection = document.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;
    const range = selection.getRangeAt(0);
    return this.#of.chapter.contains(range.commonAncestorContainer) ? range : null;
  }

  readonly #changed = () => {
    const range = this.#inChapter();
    if (range) this.#range = range.cloneRange();
    else this.hide();
  };

  #later(): void {
    if (touch()) return;
    clearTimeout(this.#timer);
    this.#timer = setTimeout(() => {
      const range = this.#inChapter();
      if (range) placeBar(this.element, range.getBoundingClientRect());
    }, SHOW_AFTER_MS);
  }
}
