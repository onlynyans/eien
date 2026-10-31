// The selection bar over a book (#40, Phase 2c; spec §4's selection bar,
// its look and its place): a selection in the chapter, left still, shows
// Highlight (Phase 5a; "Take off the highlight" on words that lie in one),
// Quote in the note and Copy just above its start, as words. It never shows
// while the pointer is down, and goes on Esc, a scroll, the page losing the
// keyboard, or the selection gone. Not on a touch screen, where the
// system's own callout is over the words: there the page's ⋯ offers Quote,
// and quotes the words last chosen, which a tap on the ⋯ may have dropped.
// A selection reaching past the chapter counts for the part inside it.

import { FORMAT_COMMANDS } from '../../core/format';
import { ariaKeys } from '../chrome/keys';
import { h } from '../dom';
import { placeBar } from '../editor/selection-bar';
import { touch } from '../menu/menu';

const SHOW_AFTER_MS = 250;

const MAC = /Mac|iPhone|iPad/.test(navigator.platform);

/** Highlight's keys: H, and a note's own Format → Highlight, which a book's words take too. */
const HIGHLIGHT_KEYS = ['H', FORMAT_COMMANDS.find((command) => command.id === 'highlight')?.key]
  .filter((key): key is string => key !== undefined)
  .map((key) => (key === 'H' ? key : ariaKeys(key, MAC)))
  .join(' ');

export interface BookSelectionOf {
  readonly chapter: HTMLElement;
  /** The page's scroller: a scroll, Esc or the keyboard leaving it takes the bar away. */
  readonly scroller: HTMLElement;
  /** Quote the selection in the note beside. */
  quote(): void;
  /** Highlight the selection, or take off the highlight it lies in. */
  highlight(): void;
  /** Whether `range`'s words lie in one highlight. */
  inHighlight(range: Range): boolean;
}

/** The bar's Highlight, as it reads on words that lie in a highlight and on others. */
export const HIGHLIGHT_LABELS = { add: 'Highlight', off: 'Take off the highlight' } as const;

/** The part of the window's selection inside `root`, or null for none. */
function chosenIn(root: HTMLElement): Range | null {
  const selection = document.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;
  const range = selection.getRangeAt(0);
  if (!range.intersectsNode(root)) return null;
  const clipped = range.cloneRange();
  if (!root.contains(range.startContainer)) clipped.setStart(root, 0);
  if (!root.contains(range.endContainer)) clipped.setEnd(root, root.childNodes.length);
  return clipped.collapsed || clipped.toString().trim() === '' ? null : clipped;
}

export class BookSelection {
  readonly element: HTMLElement;
  readonly #of: BookSelectionOf;
  #timer: ReturnType<typeof setTimeout> | undefined;
  /** The words last chosen in the chapter: what the phone's ⋯ quotes. */
  #kept: Range | null = null;
  /** Highlight, or Take off the highlight. */
  readonly #highlight: HTMLButtonElement;

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
    this.#highlight = button(HIGHLIGHT_LABELS.add, HIGHLIGHT_KEYS, () => of.highlight());
    this.element = h(
      'div',
      {
        class: 'selection-bar',
        attrs: { role: 'toolbar', 'aria-label': 'The selection', hidden: true },
      },
      this.#highlight,
      button('Quote in the note', 'Q', () => of.quote()),
      // The page's own copy (./book-words.ts) gives the words alone.
      button('Copy', 'Meta+C Control+C', () => document.execCommand('copy')),
    );
    document.body.append(this.element);
    // On the scroller, so a drag that runs past the chapter's last words still shows the bar.
    of.scroller.addEventListener('mouseup', () => this.#later());
    of.scroller.addEventListener('keyup', (event) => {
      if (event.shiftKey || event.key === 'Shift') this.#later();
    });
    of.chapter.addEventListener('mousedown', () => {
      this.hide();
      this.#kept = null;
    });
    of.scroller.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') this.hide();
    });
    of.scroller.addEventListener('scroll', () => this.hide(), { passive: true });
    of.scroller.addEventListener('focusout', (event) => {
      if (!(event.relatedTarget instanceof Node && this.element.contains(event.relatedTarget)))
        this.hide();
    });
    document.addEventListener('selectionchange', this.#changed);
    // The window laid out anew (a resize, the pages moving): the bar would stand where the words were.
    window.addEventListener('resize', this.#hidden);
  }

  /** The words chosen in the chapter now; null for none. */
  get range(): Range | null {
    return chosenIn(this.#of.chapter);
  }

  /** The words chosen now, or else last chosen while this chapter is drawn: a phone's ⋯ quotes them. */
  get kept(): Range | null {
    const kept = this.#kept;
    return (
      this.range ?? (kept && this.#of.chapter.contains(kept.commonAncestorContainer) ? kept : null)
    );
  }

  /** Another chapter drawn, or none: nothing chosen in it yet. */
  forget(): void {
    this.hide();
    this.#kept = null;
  }

  hide(): void {
    clearTimeout(this.#timer);
    this.element.hidden = true;
  }

  remove(): void {
    this.forget();
    document.removeEventListener('selectionchange', this.#changed);
    window.removeEventListener('resize', this.#hidden);
    this.element.remove();
  }

  readonly #hidden = () => this.hide();

  readonly #changed = () => {
    const range = this.range;
    if (range) this.#kept = range;
    else this.hide();
  };

  #later(): void {
    if (touch()) return;
    clearTimeout(this.#timer);
    this.#timer = setTimeout(() => {
      const range = this.range;
      if (range)
        this.#highlight.textContent = this.#of.inHighlight(range)
          ? HIGHLIGHT_LABELS.off
          : HIGHLIGHT_LABELS.add;
      // Just above where the selection starts: its first line's box, not the whole block's.
      const start = range?.getClientRects()[0] ?? range?.getBoundingClientRect();
      if (start) placeBar(this.element, start);
    }, SHOW_AFTER_MS);
  }
}
