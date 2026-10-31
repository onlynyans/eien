// A book's marks on its page (#40, Phase 4b and 5): its bookmarks
// (./page-bookmarks.ts) and its highlights (./page-highlights.ts), each read
// with the book's place and kept in step by the store (./reading-store.ts).
// One part for the side, over the book's reading file: which book, how its
// file stands, one listener for both kinds, and a change that couldn't be
// kept said once, in the same words for either; and `]` and `[` walking
// both kinds in the book's order (Phase 5b).

import { type Epub, type Mark, marksInOrder, type ReadingKept, walkMarks } from '../../core/epub';
import { NO_MARKS } from '../list/contents-list';
import type { Still } from './book-count';
import type { EpubPage } from './epub-page';
import { PageBookmarks } from './page-bookmarks';
import { PageHighlights } from './page-highlights';
import type { MarksEdit, ReadingMarks, ReadingRead, ReadingStore } from './reading-store';

/** What the colophon says of a reading file this Eien won't write over. */
export const NOT_KEPT: Partial<Record<ReadingKept, string>> = {
  unreadable:
    'This book’s reading file can’t be read: its place and marks aren’t kept until it’s fixed or deleted.',
  newer: 'A newer Eien keeps this book’s place and marks: they aren’t changed here.',
};

/** What's said of a change the file took no part in refusing: a write that failed. */
const NOT_WRITTEN = 'That couldn’t be kept: try again.';

/** A change to the book's marks, kept: the marks the file then holds; or null, already said why not. */
export type ChangeMarks = (edit: MarksEdit) => Promise<ReadingMarks | null>;

export interface BookMarksOf {
  readonly page: EpubPage;
  readonly store: ReadingStore;
  /** The chapter drawn: its file in the zip, or null for none. */
  chapter(): string | null;
  /** `then` once no turn shows a copy of a page. */
  still: Still;
  /** The turn in flight landed now. */
  land(): void;
  /** How the page's marks look changed (the page bookmarked or not): its tools show it. */
  changed(): void;
  /** The book's marks changed: the list's Marks and the strip show them. */
  listed(): void;
  /** The book open. */
  epub(): Epub | null;
  /** The spine item drawn; -1 for none. */
  spine(): number;
  /** Show a place: spine item `index`, at an offset in its words (`]` and `[`). */
  goTo(index: number, offset: number): void;
}

/** What `]` and `[` say they came to: its kind, and its place among them all. */
const KIND_WORDS: Readonly<Record<Mark['kind'], string>> = {
  bookmark: 'Bookmark',
  highlight: 'Highlight',
};

export class BookMarks {
  readonly bookmarks: PageBookmarks;
  readonly highlights: PageHighlights;
  readonly #of: BookMarksOf;
  #key: string | null = null;
  #unlisten = () => {};
  /** The words in sight, as last measured; null while none are. */
  #sight: { readonly from: number; readonly to: number } | null = null;

  constructor(of: BookMarksOf) {
    this.#of = of;
    const parts = { ...of, change: (edit: MarksEdit) => this.#change(edit) };
    this.bookmarks = new PageBookmarks(parts);
    this.highlights = new PageHighlights(parts);
  }

  /** The book `key` names opened: its marks as read, followed as this window changes them; a file it won't write, said. */
  opened(key: string, read: ReadingRead): void {
    this.clear();
    this.#key = key;
    this.#told(read.marks);
    this.#unlisten = this.#of.store.listen(key, (marks) => {
      this.#told(marks);
      this.#of.listed();
    });
    const words = NOT_KEPT[read.kept];
    if (read.kept === 'unreadable' && words) this.#of.page.foot.say(words);
  }

  /** Every mark of the book's that's in it, in its order (Marks, the strip, `]` and `[`). */
  inOrder(epub: Epub | null): Mark[] {
    if (!epub) return [];
    const spine = epub.spine.map((item) => item.path);
    return marksInOrder(this.bookmarks.all, this.highlights.all, spine);
  }

  /**
   * `]` (`way` 1) or `[` (-1): to the next mark past the words in sight, or
   * the one before them, round the book past either end; said in the colophon.
   */
  walk(way: 1 | -1): void {
    const { page } = this.#of;
    const marks = this.inOrder(this.#of.epub());
    const sight = this.#sight ?? { from: 0, to: 0 };
    const walked = walkMarks(marks, { spine: this.#of.spine(), ...sight }, way);
    if (!walked) {
      page.foot.say(NO_MARKS);
      return;
    }
    const { mark, index, round } = walked;
    this.#of.goTo(mark.spine, mark.offset);
    const count = `${marks.length} ${marks.length === 1 ? 'mark' : 'marks'}`;
    const where = `${KIND_WORDS[mark.kind]}, ${index + 1} of ${count}.`;
    page.foot.say(
      round ? `${way > 0 ? 'Round to the first' : 'Round to the last'}: ${where}` : where,
    );
  }

  /** The words in sight measured. */
  inSight(from: number, to: number): void {
    this.#sight = { from, to };
    this.bookmarks.inSight(from, to);
    this.highlights.inSight(from, to);
  }

  /** No words in sight measured in the chapter drawn (on its way, or refused). */
  away(): void {
    this.#sight = null;
    this.bookmarks.away();
    this.highlights.away();
  }

  /** No book: nothing kept of its marks. */
  clear(): void {
    this.#unlisten();
    this.#unlisten = () => {};
    this.#key = null;
    this.bookmarks.clear();
    this.highlights.clear();
  }

  #told(marks: ReadingMarks): void {
    this.bookmarks.set(marks.bookmarks);
    this.highlights.set(marks.highlights);
  }

  /** `edit` made to this book's file, once the press before it is kept; why not, said. */
  async #change(edit: MarksEdit): Promise<ReadingMarks | null> {
    const key = this.#key;
    if (!key) return null;
    const after = await this.#of.store.change(key, edit);
    // Another book opened meanwhile: nothing of this one's to say.
    if (key !== this.#key) return null;
    if (after) return after;
    // Why, as the file stands now: it may have changed since the book opened.
    const { kept } = await this.#of.store.read(key);
    if (key === this.#key) this.#of.page.foot.say(NOT_KEPT[kept] ?? NOT_WRITTEN);
    return null;
  }
}
