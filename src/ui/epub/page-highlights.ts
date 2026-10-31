// A book's highlights on its page (#40, Phase 5a): the book's list, as its
// marks hold it (./book-marks.ts), inked over the chapter drawn (a pencil
// line under the words, ./ink.ts) with a tick in the margin by each block
// they touch; and H (or the selection bar's Highlight, or Format →
// Highlight) keeping the words chosen, or taking off the highlight they lie
// in, decided against the file as it is then (core/epub/highlights.ts).
// Words are never lost: one taken off leaves its words chosen, so H keeps
// them again, and the colophon offers Put back while it says so.

import {
  firstWords,
  type Highlight,
  highlightChange,
  highlightsIn,
  highlightsOf,
  MAX_HIGHLIGHTS,
  type Span,
  withHighlights,
} from '../../core/epub';
import type { ChangeMarks } from './book-marks';
import { wordsBetween } from './chapter-place';
import { boundsOf, rangeOver, spanOf, walked } from './chapter-range';
import type { EpubPage } from './epub-page';
import { Ink, inkCopy } from './ink';

/** The blocks a highlight's tick stands beside: a paragraph's kind, never one that may hold a chapter. */
const TICKED = 'p, li, dd, dt, h1, h2, h3, h4, h5, h6, pre, td, th, figcaption, blockquote';

/** Marks a block a highlight touches: its tick (./ink.css). */
export const HIGHLIGHTED = 'data-highlighted';

/** What's said with no words chosen to keep. */
export const CHOOSE_WORDS = 'Choose some words in the book to highlight.';

export interface PageHighlightsOf {
  readonly page: EpubPage;
  /** A change to the book's marks, kept, or null (said why). */
  readonly change: ChangeMarks;
  /** The chapter drawn: its file in the zip, or null for none. */
  chapter(): string | null;
}

export class PageHighlights {
  readonly #of: PageHighlightsOf;
  readonly #ink = new Ink('epub-highlight');
  #marks: readonly Highlight[] = [];
  /** The words in sight, as last measured; null while none are. */
  #sight: Span | null = null;
  /** The last H's change, until it's kept: a press waits for the one before. */
  #pending: Promise<void> = Promise.resolve();

  constructor(of: PageHighlightsOf) {
    this.#of = of;
  }

  /** The book's highlights: every one this Eien can read, in the file's order. */
  get all(): readonly Highlight[] {
    return this.#marks;
  }

  /** The book's highlights as its file now holds them, inked. */
  set(marks: readonly Highlight[]): void {
    this.#marks = marks;
    this.paint();
  }

  /** The words in sight measured: whether a highlight is among them, said to the ear. */
  inSight(from: number, to: number): void {
    this.#sight = { from, to };
    this.#heard();
  }

  /** No words in sight measured in the chapter drawn (on its way, or refused): nothing inked. */
  away(): void {
    this.#sight = null;
    this.#ink.clear();
    this.#heard();
  }

  /** No book: nothing kept of its highlights. */
  clear(): void {
    this.#marks = [];
    this.away();
  }

  /** The chapter's highlights inked, and their blocks ticked: once it's drawn, and as they change. */
  paint(): void {
    const { chapter: words } = this.#of.page;
    const chapter = this.#of.chapter();
    const spans = chapter ? highlightsIn(this.#marks, chapter) : [];
    this.#ink.paint(words, spans);
    for (const block of words.querySelectorAll(`[${HIGHLIGHTED}]`))
      block.removeAttribute(HIGHLIGHTED);
    if (spans.length > 0) {
      const walk = walked(words);
      for (const span of spans) {
        const bounds = boundsOf(walk, span);
        if (!bounds) continue;
        const first = walk.pieces.indexOf(bounds.startContainer);
        const last = walk.pieces.indexOf(bounds.endContainer);
        for (const piece of walk.pieces.slice(first, last + 1))
          piece.parentElement?.closest(TICKED)?.setAttribute(HIGHLIGHTED, '');
      }
    }
    this.#heard();
  }

  /** Whether `range`'s words lie in one highlight: Highlight then takes it off. */
  holds(range: Range): boolean {
    const chapter = this.#of.chapter();
    const span = chapter ? spanOf(this.#of.page.chapter, range) : null;
    return (
      chapter !== null && span !== null && 'off' in highlightChange(this.#marks, chapter, span)
    );
  }

  /** A turn's copy of the page, its words from `from` on, inked as the page is. */
  inkCopy(copy: HTMLElement, from: number): void {
    const chapter = this.#of.chapter();
    if (chapter) inkCopy(copy, from, 'epub-highlight', highlightsIn(this.#marks, chapter));
  }

  /**
   * H: the words chosen (or, `kept`, last chosen: a phone's ⋯ tapped) kept as
   * a highlight, or the one they lie in taken off; after the press before it.
   */
  toggle(kept = false): Promise<void> {
    // One that fails never stops the next.
    this.#pending = this.#pending
      .then(() => this.#toggle(kept))
      .catch((error) => console.error(error));
    return this.#pending;
  }

  /** `gone` put back as it was (Put back). */
  async putBack(gone: Highlight): Promise<void> {
    const after = await this.#of.change((text) => withHighlights(text, { add: gone }));
    if (!after) return;
    this.set(after.highlights);
    this.#of.page.foot.say('Highlight put back.');
  }

  /** `gone` taken off (a Marks row's Delete, Phase 5b), with Put back. */
  async remove(gone: Highlight): Promise<void> {
    const after = await this.#of.change((text) => withHighlights(text, { remove: [gone] }));
    if (!after) return;
    this.set(after.highlights);
    this.#takenOff(gone);
  }

  async #toggle(kept: boolean): Promise<void> {
    const { page } = this.#of;
    const chapter = this.#of.chapter();
    const range = kept ? page.sheet.kept : page.sheet.selection;
    const span = chapter && range ? spanOf(page.chapter, range) : null;
    if (!chapter || !span) {
      page.foot.say(CHOOSE_WORDS);
      return;
    }
    // A book shows MAX_HIGHLIGHTS: one more would be kept but never shown, nor ever taken off.
    const now = highlightChange(this.#marks, chapter, span);
    if (!('off' in now) && this.#marks.length - now.remove.length >= MAX_HIGHLIGHTS) {
      page.foot.say(
        `A book keeps ${MAX_HIGHLIGHTS.toLocaleString('en')} highlights at most: take one off first.`,
      );
      return;
    }
    // Decided again against the file as it is when written: another device's may have come meanwhile.
    let done: Highlight | null = null;
    let off = false;
    const after = await this.#of.change((text) => {
      const change = highlightChange(highlightsOf(text), chapter, span);
      if ('off' in change) {
        off = true;
        done = change.off;
        return withHighlights(text, { remove: [change.off] });
      }
      off = false;
      const words = firstWords(wordsBetween(page.chapter, change.span.from, change.span.to));
      done = { chapter, ...change.span, words };
      return withHighlights(withHighlights(text, { remove: change.remove }), { add: done });
    });
    if (!after || !done) return;
    this.set(after.highlights);
    if (off) this.#takenOff(done);
    else {
      document.getSelection()?.removeAllRanges();
      page.foot.say('Highlighted.');
    }
  }

  /** `gone` taken off: its words chosen on the page (H keeps them again, exactly), and Put back offered. */
  #takenOff(gone: Highlight): void {
    const { page } = this.#of;
    const bounds =
      gone.chapter === this.#of.chapter() ? boundsOf(walked(page.chapter), gone) : null;
    if (bounds) {
      const selection = document.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(rangeOver(bounds));
    }
    page.foot.say('Highlight taken off.', {
      label: 'Put back',
      run: () => void this.putBack(gone),
    });
  }

  /** Whether the words in sight hold a highlight, said to the ear (the ink says it to the eye). */
  #heard(): void {
    const chapter = this.#of.chapter();
    const sight = this.#sight;
    this.#of.page.foot.highlighted(
      chapter !== null &&
        sight !== null &&
        highlightsIn(this.#marks, chapter).some(
          (each) => each.from < Math.max(sight.to, sight.from + 1) && sight.from < each.to,
        ),
    );
  }
}
