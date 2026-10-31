// A book searched (#40, Phase 5c; core/epub/find.ts): its chapters read
// and made blocks (core/epub/book-text.ts) in the reading order, in the
// background, a slice of work a task and only while no page turns, so a
// search never takes a frame from a turn or a long task from the window.
// The blocks are kept while a page holds the book, so the next words cost a
// pattern over text already read. The matches arrive in the
// book's order, told as they come but not more often than the eye needs;
// the find bar's count is the limit (core/find).

import {
  type BookBlock,
  chapterBlocks,
  type Epub,
  type Found,
  findIn,
  foundPlace,
  isRefusal,
  type Walk,
  walkPlaces,
} from '../../core/epub';
import { COUNT_LIMIT } from '../../core/find';
import type { Still } from './still';

/** The most work a task does before it gives the window back: well inside a frame. */
const SLICE_MS = 8;

/** How often matches arriving are told: the list redraws no faster. */
const TELL_MS = 100;

/**
 * The window's chapters read for Find, each book's kept while a page holds
 * it (`hold`), so the next words search what's read; let go with the last.
 */
export class BookTexts {
  readonly #books = new Map<
    string,
    { holders: number; blocks: Map<number, readonly BookBlock[]> }
  >();

  /** A page holds the book `key` names: its chapters read are kept until every page lets it go. */
  hold(key: string): () => void {
    const book = this.#books.get(key) ?? { holders: 0, blocks: new Map() };
    book.holders++;
    this.#books.set(key, book);
    let held = true;
    return () => {
      if (!held) return;
      held = false;
      book.holders--;
      if (book.holders === 0) this.#books.delete(key);
    };
  }

  /** Spine item `spine` of `epub` as blocks, if they're kept. */
  kept(epub: Epub, spine: number): readonly BookBlock[] | undefined {
    return this.#books.get(epub.key)?.blocks.get(spine);
  }

  /** Spine item `spine` of `epub` read and made blocks, kept while a page holds the book; a chapter that won't open has none. */
  async read(epub: Epub, spine: number): Promise<readonly BookBlock[]> {
    const kept = this.kept(epub, spine);
    if (kept) return kept;
    const chapter = await epub.chapter(spine);
    const blocks = isRefusal(chapter) ? [] : chapterBlocks(chapter.nodes);
    this.#books.get(epub.key)?.blocks.set(spine, blocks);
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
  /** When matches were last told, and the tell held back until the pause is up. */
  #told = 0;
  #tell: ReturnType<typeof setTimeout> | undefined;

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

  /**
   * Find's next (`way` 1) or previous match from a place: the first past it,
   * or the last before it, round the book; 'wait' while the search hasn't
   * yet looked where that is (the matches arrive in the book's order, so one
   * found past the place is the next, and those before it are all found once
   * its chapter is searched); null for none at all.
   */
  walk(spine: number, from: number, way: 1 | -1): Walk<Found> | 'wait' | null {
    const walk = walkPlaces(this.#found, foundPlace, { spine, from, to: from + 1 }, way);
    if (this.#done) return walk;
    const covered = this.#searched > spine;
    if (way > 0 ? walk === null || walk.round : !covered || walk?.round) return 'wait';
    return walk;
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
    clearTimeout(this.#tell);
    this.#timer = undefined;
    this.#tell = undefined;
  }

  /**
   * What's found told: at once at the end, or once the pause since the last
   * tell is up, so matches found meanwhile are never left untold while a
   * long chapter is read or a turn holds the search.
   */
  #tellFound(run: number): void {
    if (this.#done) {
      clearTimeout(this.#tell);
      this.#tell = undefined;
      this.#told = performance.now();
      this.#of.changed();
      return;
    }
    if (this.#tell !== undefined) return;
    const wait = Math.max(0, TELL_MS - (performance.now() - this.#told));
    this.#tell = setTimeout(() => {
      this.#tell = undefined;
      if (run !== this.#run) return;
      this.#told = performance.now();
      this.#of.changed();
    }, wait);
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
    this.#tellFound(run);
    if (!this.#done) next(at);
  }
}
