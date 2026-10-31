// A book searched (#40, Phase 5c; core/epub/find.ts): its chapters read
// and made blocks (core/epub/book-text.ts) in the reading order, in the
// background, a slice of work a task and only while no page turns, so a
// search never takes a frame from a turn or a long task from the window.
// The blocks are kept for the book searched (the window's last), so the next
// words cost a pattern over text already read. The matches arrive in the
// book's order, told as they come but not more often than the eye needs;
// the find bar's count is the limit (core/find).

import {
  type BookBlock,
  chapterBlocks,
  type Epub,
  type Found,
  findIn,
  isRefusal,
} from '../../core/epub';
import { COUNT_LIMIT } from '../../core/find';
import type { Still } from './book-count';

/** The most work a task does before it gives the window back: well inside a frame. */
const SLICE_MS = 8;

/** How often matches arriving are told: the list redraws no faster. */
const TELL_MS = 100;

/** The window's chapters read for Find: the last book searched, kept. */
export class BookTexts {
  #key: string | null = null;
  readonly #blocks = new Map<number, readonly BookBlock[]>();

  /** Spine item `spine` of `epub` as blocks, if they're kept; the book another, the last one's let go. */
  kept(epub: Epub, spine: number): readonly BookBlock[] | undefined {
    if (this.#key !== epub.key) {
      this.#key = epub.key;
      this.#blocks.clear();
    }
    return this.#blocks.get(spine);
  }

  /** Spine item `spine` of `epub` read and made blocks, and kept; a chapter that won't open has none. */
  async read(epub: Epub, spine: number): Promise<readonly BookBlock[]> {
    const kept = this.kept(epub, spine);
    if (kept) return kept;
    const chapter = await epub.chapter(spine);
    const blocks = isRefusal(chapter) ? [] : chapterBlocks(chapter.nodes);
    // Kept only while it's still this book's: another may have been searched meanwhile.
    if (this.#key === epub.key) this.#blocks.set(spine, blocks);
    return blocks;
  }
}

export interface BookSearchOf {
  readonly texts: BookTexts;
  /** Matches arrived, or the search ended: whoever shows them looks again. */
  changed(): void;
}

/** One search over a book at a time: a new one stops the last. */
export class BookSearch {
  readonly #of: BookSearchOf;
  #found: Found[] = [];
  #searched = 0;
  #done = true;
  /** Counts the searches asked for, so a stopped one never tells. */
  #run = 0;
  #timer: ReturnType<typeof setTimeout> | undefined;
  #told = 0;

  constructor(of: BookSearchOf) {
    this.#of = of;
  }

  /** The matches so far, in the book's order. */
  get found(): readonly Found[] {
    return this.#found;
  }

  /** How many of the book's chapters are searched so far. */
  get searched(): number {
    return this.#searched;
  }

  /** Whether the search is through the book, or stopped at the limit. */
  get done(): boolean {
    return this.#done;
  }

  /** Whether there are more matches than are kept. */
  get more(): boolean {
    return this.#found.length >= COUNT_LIMIT;
  }

  /** Search `epub` for `matcher`, `still` saying when no page turns; null for none, which clears it. */
  search(epub: Epub | null, matcher: RegExp | null, still: Still): void {
    this.stop();
    this.#found = [];
    this.#searched = 0;
    this.#done = !epub || !matcher;
    if (!epub || !matcher) return void this.#of.changed();
    const run = this.#run;
    const step = (spine: number): void => {
      this.#timer = setTimeout(() => {
        this.#timer = undefined;
        still(() => void this.#slice(epub, matcher, spine, run, step));
      }, 0);
    };
    step(0);
  }

  /** Nothing searched, nothing found, told nothing: a search no longer asked for. */
  clear(): void {
    this.stop();
    this.#found = [];
    this.#searched = 0;
    this.#done = true;
  }

  /** No more searching: what's found stays, told no more. */
  stop(): void {
    this.#run++;
    clearTimeout(this.#timer);
    this.#timer = undefined;
  }

  /** Chapters from `spine` on searched, until the slice's time is up; then the next slice, or the end. */
  async #slice(
    epub: Epub,
    matcher: RegExp,
    spine: number,
    run: number,
    next: (spine: number) => void,
  ): Promise<void> {
    const began = performance.now();
    let at = spine;
    // A chapter not yet read is read alone in its task: reading it is the most a task may do.
    while (at < epub.spine.length && run === this.#run) {
      const kept = this.#of.texts.kept(epub, at);
      if (!kept && at > spine) break;
      const blocks = kept ?? (await this.#of.texts.read(epub, at));
      if (run !== this.#run) return;
      this.#found.push(...findIn(blocks, matcher, at, COUNT_LIMIT - this.#found.length));
      this.#searched = ++at;
      if (this.more || performance.now() - began >= SLICE_MS) break;
    }
    if (run !== this.#run) return;
    this.#done = this.more || at >= epub.spine.length;
    if (this.#done || performance.now() - this.#told >= TELL_MS) {
      this.#told = performance.now();
      this.#of.changed();
    }
    if (!this.#done) next(at);
  }
}
