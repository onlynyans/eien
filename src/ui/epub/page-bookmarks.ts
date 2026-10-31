// A book's bookmarks on its page (#40, Phase 4b): the book's list, read with
// its place and kept in step by the store (./reading-store.ts), whether the
// page in sight holds one (in pages, from its first word to the next page's;
// scrolling, the lines in sight), and B or the tool putting one there or
// taking it off. What the page shows follows a turn once it lands, never
// mid-turn, as a mark on paper would. On a spread (Phase 3d) the mark sits on
// the page it marks; B marks the spread's first word, or takes off every
// bookmark on its two pages. Eien's front matter holds none of the book's
// words: nothing there to mark.

import {
  BOOKMARK_WORDS,
  type Bookmark,
  bookmarksOn,
  firstWords,
  MAX_BOOKMARKS,
  type ReadingKept,
} from '../../core/epub';
import type { Still } from './book-count';
import { wordsFrom } from './chapter-place';
import type { EpubPage } from './epub-page';
import type { ReadingRead, ReadingStore } from './reading-store';
import { allFront } from './sight';

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
  /** The book's bookmarks changed: the list's Marks show them (Phase 4c). */
  listed(): void;
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
    // Shown, as every change is, once the page is still: never against a turn's page on its way.
    this.#unlisten = this.#of.store.listen(key, (marks) => {
      this.#marks = marks;
      this.#of.still(() => this.#show());
      this.#of.listed();
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
    if (!this.#measured || allFront(page.sheet.sight)) return;
    const here = bookmarksOn(this.#marks, chapter, this.#from, this.#to);
    // A book shows MAX_BOOKMARKS: one more would be kept but never shown, nor ever taken off.
    if (here.length === 0 && this.#marks.length >= MAX_BOOKMARKS) {
      page.foot.say(
        `A book keeps ${MAX_BOOKMARKS.toLocaleString('en')} bookmarks at most: take one off first.`,
      );
      return;
    }
    const words = firstWords(wordsFrom(page.chapter, this.#from, BOOKMARK_WORDS * 2));
    const change =
      here.length > 0 ? { remove: here } : { add: { chapter, offset: this.#from, words } };
    const after = await this.#of.store.mark(key, change);
    if (key !== this.#key) return;
    if (!after) return this.#notKept(key);
    this.#marks = after;
    this.#of.still(() => this.#show());
    page.foot.say(here.length > 0 ? 'Bookmark taken off.' : 'Bookmarked.');
  }

  /** `mark` taken off (a Marks row's Delete), said in the colophon. */
  async remove(mark: Bookmark): Promise<void> {
    const key = this.#key;
    if (!key) return;
    const after = await this.#of.store.mark(key, { remove: [mark] });
    if (key !== this.#key) return;
    if (!after) return this.#notKept(key);
    this.#of.page.foot.say('Bookmark taken off.');
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
    const marked = (from: number, to: number) =>
      chapter !== null && this.#measured && bookmarksOn(this.#marks, chapter, from, to).length > 0;
    // A spread's recto begins where its own words do; one page (or a scroll) is all the right's.
    const recto = this.#of.page.sheet.sight[1];
    const left = recto ? marked(this.#from, recto.from) : false;
    const right = recto ? marked(recto.from, this.#to) : marked(this.#from, this.#to);
    const on = left || right;
    this.#of.page.bookmarked(left, right);
    if (on === this.#on) return;
    this.#on = on;
    this.#of.changed();
  }
}
