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

/** How many books' counts the window keeps. */
const KEPT_BOOKS = 4;

/** Run `then` once no page is turning. */
export type Still = (then: () => void) => void;

export class BookCount implements PageCount {
  readonly #lengths: (number | null)[];
  /** Each item's printed pages' places, once counted. */
  readonly #found: (ReadonlyMap<string, number> | null)[];
  /** Each printed page: its label, its item, and the place it names there ('' for its start). */
  readonly #pages: readonly { label: string; spine: number; fragment: string }[];
  /** The names each item's printed pages give, asked of its count. */
  readonly #names: ReadonlyMap<number, ReadonlySet<string>>;
  readonly #told = new Set<() => void>();
  readonly #still = new Set<Still>();
  /** Which epub reads the rest, while any page asks for it; null between. */
  #reading: Epub | null = null;
  #timer: ReturnType<typeof setTimeout> | undefined;
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
    for (const told of this.#told) told();
  }

  /**
   * Count the rest of `epub` in the background, `still` saying when no page
   * of its turns, and `told` after each item. Undone by the function it
   * returns; the count stops once no page asks for it.
   */
  run(epub: Epub, still: Still, told: () => void): () => void {
    this.#told.add(told);
    this.#still.add(still);
    this.#reading = epub;
    this.#next();
    return () => {
      this.#told.delete(told);
      this.#still.delete(still);
      if (this.#still.size > 0) return;
      this.#reading = null;
      clearTimeout(this.#timer);
      this.#timer = undefined;
    };
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
    if (this.#timer !== undefined || !this.#reading) return;
    const spine = this.#lengths.indexOf(null);
    if (spine < 0) return;
    this.#timer = setTimeout(() => {
      // Each page still, one after another; then the item, if it's still wanted.
      const waits = [...this.#still];
      const after = (i: number): void => {
        const wait = waits[i];
        if (wait) return wait(() => after(i + 1));
        void this.#count(spine);
      };
      after(0);
    }, 0);
  }

  async #count(spine: number): Promise<void> {
    const epub = this.#reading;
    if (!epub) {
      this.#timer = undefined;
      return;
    }
    const chapter = await epub.chapter(spine);
    this.#timer = undefined;
    // A chapter that won't open has no words to count.
    if (isRefusal(chapter)) this.add(spine, { nodes: [], images: [] });
    else this.add(spine, chapter);
    if (this.#reading) this.#next();
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
