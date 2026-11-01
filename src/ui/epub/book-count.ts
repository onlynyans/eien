// A book counted for its page numbers (#40, Phase 4; core/epub/page-numbers.ts):
// each spine item's words, and where its printed pages begin, counted once
// (core/epub/chapter-count.ts). The chapter drawn is counted as it's drawn;
// the rest in the background, one item a task, only while no page turns, so
// counting never takes a frame from a turn or a long task from the window.
// One count per book (by its key) for the window, however many pages show
// it, kept for the last few books so reopening one costs nothing; a count
// stopped part way goes on from there. It keeps numbers alone: never the
// book, whose bytes go with its pages.

import {
  type Chapter,
  countChapter,
  type Epub,
  isRefusal,
  type PageCount,
  type PrintAt,
} from '../../core/epub';
import { allStill, type Still } from './still';

/** How many books' counts the window keeps. */
const KEPT_BOOKS = 4;

export class BookCount implements PageCount {
  readonly #lengths: (number | null)[];
  /** Each item's printed pages' places, once counted. */
  readonly #found: (ReadonlyMap<string, number> | null)[];
  /** Each printed page: its label, its item, and the place it names there ('' for its start). */
  readonly #pages: readonly { label: string; spine: number; fragment: string }[];
  /** The names each item's printed pages give, asked of its count. */
  readonly #names: ReadonlyMap<number, ReadonlySet<string>>;
  /** Each page asking for the count: how to tell it, and its book, read from while it asks. */
  readonly #runs = new Map<
    object,
    { readonly still: Still; readonly told: (spine: number) => void; readonly epub: Epub }
  >();
  #timer: ReturnType<typeof setTimeout> | undefined;
  /** An item read and counted now: one at a time, whatever starts or stops meanwhile. */
  #busy = false;
  #print: readonly PrintAt[] = [];

  constructor(epub: Epub) {
    this.#lengths = epub.spine.map(() => null);
    this.#found = epub.spine.map(() => null);
    const spineOf = new Map(epub.spine.map((item, i) => [item.path, i]));
    this.#pages = epub.printPages.flatMap(({ label, path, fragment }) => {
      const spine = spineOf.get(path);
      return spine === undefined ? [] : [{ label, spine, fragment }];
    });
    const names = new Map<number, Set<string>>();
    for (const page of this.#pages) {
      if (page.fragment === '') continue;
      const set = names.get(page.spine) ?? new Set<string>();
      set.add(page.fragment);
      names.set(page.spine, set);
    }
    this.#names = names;
    this.#printed();
  }

  get lengths(): readonly (number | null)[] {
    return this.#lengths;
  }

  get print(): readonly PrintAt[] {
    return this.#print;
  }

  /** Whether every item is counted. */
  get whole(): boolean {
    return this.#lengths.every((length) => length !== null);
  }

  /** Spine item `spine`, as drawn, counted (once). */
  add(spine: number, chapter: Chapter): void {
    if (spine < 0 || spine >= this.#lengths.length || this.#lengths[spine] !== null) return;
    const { length, anchors } = countChapter(chapter.nodes, this.#names.get(spine));
    this.#lengths[spine] = length;
    this.#found[spine] = anchors;
    this.#printed();
    for (const run of this.#runs.values()) run.told(spine);
  }

  /**
   * Count the rest of `epub` in the background, `still` saying when no page
   * of its turns, and `told` after each item, which one. Undone by the function it
   * returns; the count stops once no page asks for it.
   */
  run(epub: Epub, still: Still, told: (spine: number) => void): () => void {
    const run = {};
    this.#runs.set(run, { still, told, epub });
    this.#next();
    return () => {
      // Its book let go with it: another page's is read from, if one still asks.
      this.#runs.delete(run);
      if (this.#runs.size > 0) return;
      clearTimeout(this.#timer);
      this.#timer = undefined;
    };
  }

  /** A book to read the rest from: any asking page's (one book, by its key). */
  get #reading(): Epub | null {
    for (const run of this.#runs.values()) return run.epub;
    return null;
  }

  #printed(): void {
    this.#print = this.#pages.map(({ label, spine, fragment }) => ({
      label,
      spine,
      offset: fragment === '' ? 0 : (this.#found[spine]?.get(fragment) ?? null),
    }));
  }

  /** The next item counted, in a task of its own, once every page is still. */
  #next(): void {
    if (this.#timer !== undefined || this.#busy || this.#runs.size === 0) return;
    const spine = this.#lengths.indexOf(null);
    if (spine < 0) return;
    this.#timer = setTimeout(() => {
      this.#timer = undefined;
      this.#busy = true;
      // Every page asking for the count still at once (./still.ts).
      allStill(
        () => [...this.#runs.values()].map((run) => run.still),
        () => void this.#count(spine),
      );
    }, 0);
  }

  async #count(spine: number): Promise<void> {
    const epub = this.#reading;
    try {
      if (!epub) return;
      const chapter = await epub.chapter(spine);
      // A chapter that won't open has no words to count.
      this.add(spine, isRefusal(chapter) ? { nodes: [], images: [] } : chapter);
    } finally {
      this.#busy = false;
      this.#next();
    }
  }
}

/** The window's counts, one per book, the last few kept. */
export class BookCounts {
  readonly #kept = new Map<string, BookCount>();

  /** `epub`'s count: the one kept for its key, or a new one. */
  of(epub: Epub): BookCount {
    const kept = this.#kept.get(epub.key) ?? new BookCount(epub);
    // The latest asked for last, so the oldest goes first.
    this.#kept.delete(epub.key);
    this.#kept.set(epub.key, kept);
    for (const key of this.#kept.keys()) {
      if (this.#kept.size <= KEPT_BOOKS) break;
      this.#kept.delete(key);
    }
    return kept;
  }
}
