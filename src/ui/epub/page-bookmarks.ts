// A book's bookmarks on its page (#40, Phase 4b): the book's list, read with
// its place and kept in step by the store (./reading-store.ts), whether the
// page in sight holds one (in pages, from its first word to the next page's;
// scrolling, the lines in sight), and B or the tool putting one there or
// taking it off. What the page shows follows a turn once it lands, never
// mid-turn, as a mark on paper would.

import {
  BOOKMARK_WORDS,
  type Bookmark,
  bookmarksOn,
  firstWords,
  type ReadingKept,
} from '../../core/epub';
import type { Still } from './book-count';
import { wordsFrom } from './chapter-place';
import type { EpubPage } from './epub-page';
import type { ReadingRead, ReadingStore } from './reading-store';

/** What the colophon says of a reading file this Eien won't write over. */
const NOT_KEPT: Partial<Record<ReadingKept, string>> = {
  unreadable:
    'This book’s reading file can’t be read: its place and bookmarks aren’t kept until it’s fixed or deleted.',
  newer: 'A newer Eien keeps this book’s place and bookmarks: they aren’t changed here.',
};

export interface PageBookmarksOf {
  readonly page: EpubPage;
  readonly store: ReadingStore;
  /** The chapter drawn: its file in the zip, or null for none. */
  chapter(): string | null;
  /** `then` once no turn shows a copy of a page. */
  still: Still;
  /** The turn in flight landed now. */
  land(): void;
  /** Whether the page in sight is bookmarked changed: the tool shows it. */
  changed(): void;
}

export class PageBookmarks {
  readonly #of: PageBookmarksOf;
  #key: string | null = null;
  #kept: ReadingKept = 'none';
  #marks: readonly Bookmark[] = [];
  /** The words in sight, as last measured. */
  #from = 0;
  #to = 0;
  /** Whether they're measured in the chapter drawn: none are while it's on its way, or refused. */
  #measured = false;
  #on = false;
  #unlisten = () => {};
  /** The last B's change, until it's kept: a press waits for the one before, so two quick ones undo each other. */
  #pending: Promise<void> = Promise.resolve();

  constructor(of: PageBookmarksOf) {
    this.#of = of;
  }

  /** The book's bookmarks: every one this Eien can read, in the file's order. */
  get all(): readonly Bookmark[] {
    return this.#marks;
  }

  /** Whether the page in sight holds a bookmark. */
  get on(): boolean {
    return this.#on;
  }

  /** The book `key` names opened: its bookmarks as read, followed as this window changes them; a file it won't write, said. */
  opened(key: string, read: ReadingRead): void {
    this.clear();
    this.#key = key;
    this.#kept = read.kept;
    this.#marks = read.bookmarks;
    this.#unlisten = this.#of.store.listen(key, (marks) => {
      this.#marks = marks;
      this.#show();
    });
    const words = NOT_KEPT[read.kept];
    if (read.kept === 'unreadable' && words) this.#of.page.foot.say(words);
  }

  /** The words in sight measured: shown once the page is still. */
  inSight(from: number, to: number): void {
    this.#from = from;
    this.#to = to;
    this.#measured = true;
    this.#of.still(() => this.#show());
  }

  /**
   * B, or the tool: a bookmark at the page's first word, or the page's taken
   * off; measured where the page stands now, any turn landed first, after
   * the press before it is kept.
   */
  toggle(): Promise<void> {
    // One that fails never stops the next.
    this.#pending = this.#pending.then(() => this.#toggle()).catch((error) => console.error(error));
    return this.#pending;
  }

  async #toggle(): Promise<void> {
    const key = this.#key;
    const chapter = this.#of.chapter();
    if (!key || !chapter) return;
    const { page } = this.#of;
    this.#of.land();
    page.sheet.keep();
    if (!this.#measured) return;
    const here = bookmarksOn(this.#marks, chapter, this.#from, this.#to);
    const words = firstWords(wordsFrom(page.chapter, this.#from, BOOKMARK_WORDS * 2));
    const change =
      here.length > 0 ? { remove: here } : { add: { chapter, offset: this.#from, words } };
    const after = await this.#of.store.mark(key, change);
    if (key !== this.#key) return;
    if (!after) return this.#notKept(key);
    this.#marks = after;
    this.#show();
    page.foot.say(here.length > 0 ? 'Bookmark taken off.' : 'Bookmarked.');
  }

  /** A change not kept: why, as the file stands now (it may have changed since the book opened). */
  async #notKept(key: string): Promise<void> {
    const { kept } = await this.#of.store.read(key);
    this.#kept = kept;
    this.#of.page.foot.say(NOT_KEPT[kept] ?? 'The bookmark couldn’t be kept: try again.');
  }

  /** No words in sight measured in the chapter drawn (on its way, or refused): no bookmark shown. */
  away(): void {
    this.#measured = false;
    this.#show();
  }

  /** No book: nothing kept of its bookmarks. */
  clear(): void {
    this.#unlisten();
    this.#unlisten = () => {};
    this.#key = null;
    this.#kept = 'none';
    this.#marks = [];
    this.#show();
  }

  #show(): void {
    const chapter = this.#of.chapter();
    const on =
      chapter !== null &&
      this.#measured &&
      bookmarksOn(this.#marks, chapter, this.#from, this.#to).length > 0;
    this.#of.page.bookmarked(on);
    if (on === this.#on) return;
    this.#on = on;
    this.#of.changed();
  }
}
