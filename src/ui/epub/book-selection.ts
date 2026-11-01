// The selection bar over a book (#40, Phase 2c; spec §4's selection bar,
// its look and its place): a selection in the chapter, left still, shows
// Highlight (Phase 5a; "Take off the highlight" on words that lie in one),
// Quote in the note and Copy just above its start, as words. It never shows
// while the pointer is down, and goes on Esc, a scroll, the page losing the
// keyboard, or the selection gone. On a touch screen (#65), where the
// system's own menu stands by the words, it docks at the page's foot over
// the colophon while words are chosen, clear of that menu, and acts on the
// words last chosen, which a tap on it may have dropped (as the page's ⋯
// does); its choice made, the words are let go, as the system's Copy does.
// A selection reaching past the chapter counts for the part inside it.

import { FORMAT_COMMANDS } from '../../core/format';
import { ariaKeys, MAC } from '../chrome/keys';
import { h } from '../dom';
import { placeBar } from '../editor/selection-bar';
import { touch } from '../menu/menu';

const SHOW_AFTER_MS = 250;

/** Highlight's keys: H, and a note's own Format → Highlight, which a book's words take too. */
const HIGHLIGHT_KEYS = ['H', FORMAT_COMMANDS.find((command) => command.id === 'highlight')?.key]
  .filter((key): key is string => key !== undefined)
  .map((key) => (key === 'H' ? key : ariaKeys(key, MAC)))
  .join(' ');

export interface BookSelectionOf {
  readonly chapter: HTMLElement;
  /** The page's scroller: a scroll, Esc or the keyboard leaving it takes the floating bar away. */
  readonly scroller: HTMLElement;
  /** Where the bar docks on a touch screen: the page's foot, over its colophon (./epub.css). */
  readonly dock: HTMLElement;
  /** Quote the selection (or, `kept`, the words last chosen) in the note beside. */
  quote(kept: boolean): void;
  /** Highlight the selection (or, `kept`, the words last chosen), or take off the highlight it lies in. */
  highlight(kept: boolean): void;
  /** Copy `range`'s words alone (./book-words.ts), as the page's own copy gives them. */
  copy(range: Range): void;
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
  /** A finger on the docked bar: the choice it may drop meanwhile doesn't take the bar away. */
  #pressing = false;
  /** Taken off with its page: a mouseup on the scroller after it puts nothing back. */
  #removed = false;

  constructor(of: BookSelectionOf) {
    this.#of = of;
    const button = (text: string, keys: string, run: (kept: boolean) => void) =>
      h('button', {
        class: 'word-button',
        text,
        attrs: { type: 'button', 'aria-keyshortcuts': keys },
        on: {
          // The selection stays while a choice is pressed.
          mousedown: (event) => event.preventDefault(),
          click: () => {
            const docked = this.docked;
            this.#pressing = false;
            run(docked);
            this.hide();
            // Docked, its choice ends the choosing, the system's menu with it.
            if (docked) document.getSelection()?.removeAllRanges();
          },
        },
      });
    this.#highlight = button(HIGHLIGHT_LABELS.add, HIGHLIGHT_KEYS, (kept) => of.highlight(kept));
    this.element = h(
      'div',
      {
        class: 'selection-bar',
        attrs: { role: 'toolbar', 'aria-label': 'The selection', hidden: true },
        on: {
          // A finger's or a pen's: its lift or cancel always reaches the bar (the browser holds the
          // pointer where it came down). Not a mouse's, let go anywhere; its mousedown keeps the choice.
          pointerdown: (event) => {
            this.#pressing = event.pointerType !== 'mouse';
          },
          // A finger lifted off the bar, no click: the choice it dropped takes the bar away now.
          pointerup: () => this.#released(),
          pointercancel: () => this.#released(),
        },
      },
      this.#highlight,
      button('Quote in the note', 'Q', (kept) => of.quote(kept)),
      button('Copy', 'Meta+C Control+C', (kept) => {
        const range = kept ? this.kept : this.range;
        if (range) of.copy(range);
      }),
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
    // Docked, the bar stays while the words scroll with their choice, or the keyboard is elsewhere.
    of.scroller.addEventListener('scroll', () => this.#afloat(), { passive: true });
    of.scroller.addEventListener('focusout', (event) => {
      if (!(event.relatedTarget instanceof Node && this.element.contains(event.relatedTarget)))
        this.#afloat();
    });
    document.addEventListener('selectionchange', this.#changed);
    // The window laid out anew (a resize, the pages moving): the bar would stand where the words were.
    window.addEventListener('resize', this.#hidden);
  }

  /** Whether the bar is docked at the page's foot (a touch screen's) rather than floating. */
  get docked(): boolean {
    return this.element.classList.contains('selection-bar--docked');
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
    this.#removed = true;
    this.forget();
    document.removeEventListener('selectionchange', this.#changed);
    window.removeEventListener('resize', this.#hidden);
    this.element.remove();
  }

  readonly #hidden = () => this.#afloat();

  /** The floating bar taken away: it stood by words that moved, or the keyboard left. */
  #afloat(): void {
    if (!this.docked) this.hide();
  }

  readonly #changed = () => {
    const range = this.range;
    if (range) {
      this.#kept = range;
      // A touch screen's choosing has no mouseup: the bar follows the choice, settled.
      if (touch()) this.#later();
    } else if (!this.#pressing) this.hide();
  };

  #released(): void {
    if (!this.#pressing) return;
    // After the click a lift makes, which runs the choice (and says so) first.
    setTimeout(() => {
      this.#pressing = false;
      if (!this.range) this.hide();
    }, SHOW_AFTER_MS);
  }

  #later(): void {
    clearTimeout(this.#timer);
    this.#timer = setTimeout(() => this.#show(), SHOW_AFTER_MS);
  }

  #show(): void {
    const range = this.range;
    if (!range || this.#removed) return;
    this.#highlight.textContent = this.#of.inHighlight(range)
      ? HIGHLIGHT_LABELS.off
      : HIGHLIGHT_LABELS.add;
    const docked = touch();
    this.element.classList.toggle('selection-bar--docked', docked);
    const home = docked ? this.#of.dock : document.body;
    if (this.element.parentElement !== home) home.append(this.element);
    if (docked) {
      this.element.hidden = false;
      return;
    }
    // Just above where the selection starts: its first line's box, not the whole block's.
    placeBar(this.element, range.getClientRects()[0] ?? range.getBoundingClientRect());
  }
}
