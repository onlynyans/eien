// A book's highlights on its page (#40, Phase 5a): the book's list, as its
// marks hold it (./book-marks.ts), inked over the chapter drawn (a pencil
// line under the words, ./ink.ts) with a tick in the margin by each block
// they touch; and H (or the selection bar's Highlight, or Format →
// Highlight) keeping the words chosen, or taking off the highlight they lie
// in, decided against the file as it is then (core/epub/highlights.ts).
// Words are never lost: one taken off leaves its words chosen, so H keeps
// them again, and the colophon offers Put back while it says so.

import {
  BLOCK_NAMES,
  firstWords,
  HIGHLIGHT_WORDS,
  type Highlight,
  highlightChange,
  highlightsIn,
  MAX_HIGHLIGHTS,
  type Pressed,
  pressHighlight,
  type Span,
  sameHighlight,
  sightEnd,
  withHighlights,
  withRestored,
} from '../../core/epub';
import type { ChangeMarks } from './book-marks';
import { wordsBetween } from './chapter-place';
import { boundsOf, rangeOver, spanOf, walked } from './chapter-range';
import type { EpubPage } from './epub-page';
import { type CopyInk, Ink } from './ink';

/** A word's block (core's one list). */
const BLOCK = BLOCK_NAMES.join(', ');

/**
 * Where a block's tick stands instead of beside it: a list item's and a
 * cell's on its list or table, so it never lies on a bullet or a cell's words.
 */
const TICKED_ON: Readonly<Record<string, string>> = { LI: 'ul, ol', TD: 'table', TH: 'table' };

/** Marks a block a highlight touches: its tick (./ink.css). */
export const HIGHLIGHTED = 'data-highlighted';

/** What's said with no words chosen to keep. */
export const CHOOSE_WORDS = 'Choose some words in the book to highlight.';

/** The block whose margin a piece of words' tick stands in: its innermost block, if it holds no other. */
function tickedFor(piece: Text): Element | null {
  const block = piece.parentElement?.closest(BLOCK);
  // A block round others (a chapter's wrapper with a stray word in it) would tick them all.
  if (!block || block.querySelector(BLOCK)) return null;
  const on = TICKED_ON[block.tagName];
  return on ? (block.parentElement?.closest(on) ?? block) : block;
}

/** Whether two lists hold the same highlights, in order. */
const same = (a: readonly Highlight[], b: readonly Highlight[]) =>
  a.length === b.length && a.every((each, i) => sameHighlight(each, b[i] as Highlight));

export interface PageHighlightsOf {
  readonly page: EpubPage;
  /** A change to the book's marks, kept, or null (said why); what's kept reaches `set`. */
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

  /** The book's highlights as its file now holds them, inked anew if they changed. */
  set(marks: readonly Highlight[]): void {
    if (same(marks, this.#marks)) return;
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

  /** The chapter's highlights inked, and their blocks ticked, in one walk: once it's drawn, and as they change. */
  paint(): void {
    const { chapter: words } = this.#of.page;
    for (const block of words.querySelectorAll(`[${HIGHLIGHTED}]`))
      block.removeAttribute(HIGHLIGHTED);
    const spans = this.#mine();
    const walk = walked(words);
    this.#ink.paint(walk, spans);
    for (const span of spans) {
      const bounds = boundsOf(walk, span);
      if (!bounds) continue;
      for (let i = bounds.first; i <= bounds.last; i++)
        tickedFor(walk.pieces[i] as Text)?.setAttribute(HIGHLIGHTED, '');
    }
    this.#heard();
  }

  /** What a turn's copy of the page carries of the highlights: their spans in the chapter drawn. */
  copySpans(): readonly CopyInk[] {
    return [{ name: 'epub-highlight', spans: this.#mine() }];
  }

  /** Whether `range`'s words lie in one highlight: Highlight then takes it off. */
  holds(range: AbstractRange): boolean {
    const chapter = this.#of.chapter();
    const span = chapter ? spanOf(this.#of.page.chapter, range) : null;
    return (
      chapter !== null && span !== null && 'off' in highlightChange(this.#marks, chapter, span)
    );
  }

  /** Whether the words chosen (or, `kept`, last chosen) lie in one highlight. */
  holdsChosen(kept: boolean): boolean {
    const range = this.#chosen(kept);
    return range !== null && this.holds(range);
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

  /** `gone` taken off (a Marks row's Delete, Phase 5b), with Put back. */
  async remove(gone: Highlight): Promise<void> {
    const after = await this.#of.change((text) => withHighlights(text, { remove: [gone] }));
    if (after) this.#takenOff(gone);
  }

  /** `gone` put back as H would keep its words now (Put back). */
  async #putBack(gone: Highlight): Promise<void> {
    const after = await this.#of.change((text) => withRestored(text, gone));
    if (after) this.#of.page.foot.say('Highlight put back.');
  }

  async #toggle(kept: boolean): Promise<void> {
    const { page } = this.#of;
    const chapter = this.#of.chapter();
    const range = this.#chosen(kept);
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
    // The words are the page's as they're pressed: by the time the file is written another chapter
    // may be drawn. Joined with one another device's file holds that this page doesn't yet, the
    // words chosen stand for it.
    const wordsOf = (part: Span) =>
      firstWords(
        wordsBetween(page.chapter, part.from, part.to, HIGHLIGHT_WORDS * 2),
        HIGHLIGHT_WORDS,
      );
    const chosen = wordsOf(span);
    const union = 'off' in now ? null : now.span;
    const unionWords = union ? wordsOf(union) : chosen;
    let pressed: Pressed | null = null;
    const after = await this.#of.change((text) => {
      const made = pressHighlight(text, chapter, span, (part) =>
        union && part.from === union.from && part.to === union.to ? unionWords : chosen,
      );
      pressed = made;
      return made.text;
    });
    const done = pressed as Pressed | null;
    if (!after || !done?.done) return;
    if (done.off) this.#takenOff(done.done);
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
      run: () => void this.#putBack(gone),
    });
  }

  /** The highlights in the chapter drawn. */
  #mine(): Highlight[] {
    const chapter = this.#of.chapter();
    return chapter ? highlightsIn(this.#marks, chapter) : [];
  }

  /** The words chosen now, or (`kept`) last chosen in this chapter. */
  #chosen(kept: boolean): Range | null {
    const { sheet } = this.#of.page;
    return kept ? sheet.kept : sheet.selection;
  }

  /** Whether the words in sight hold a highlight, said to the ear (the ink says it to the eye). */
  #heard(): void {
    const sight = this.#sight;
    this.#of.page.foot.highlighted(
      sight !== null &&
        this.#mine().some(
          (each) => each.from < sightEnd(sight.from, sight.to) && sight.from < each.to,
        ),
    );
  }
}
