// What a book's page says of where it is (#40), as the place moves: how far
// through the chapter and the book in the colophon and the fore-edge (Phase
// 2, 3b), the page the place is on (Phase 4: the printed edition's, else a
// steady one, ./book-count.ts), told as the words in sight are measured and
// again as the count comes in, and the whole book down the page's edge
// (Phase 4d, ./book-strip.ts).

import { type Bookmark, bookFraction, type Epub, pageOf, pageWords } from '../../core/epub';
import type { BookCount } from './book-count';
import { bookStrip } from './book-strip';
import type { EpubPage } from './epub-page';

export interface BookPlaceOf {
  readonly page: EpubPage;
  epub(): Epub | null;
  /** The spine item drawn. */
  spine(): number;
  /** The book's count, while one is open. */
  count(): BookCount | null;
  /** The book's bookmarks, for the strip. */
  marks(): readonly Bookmark[];
  /** A place shown: spine item `index` at an offset, or the one it gives once drawn (where the strip goes). */
  goTo(index: number, at: number | (() => number)): void;
}

export interface BookPlace {
  /** The page scrolled or turned: how far through the chapter, 0 to 1. */
  moved(fraction: number): void;
  /** The words in sight measured: the page in pages, the lines in sight scrolling. */
  inSight(from: number, to: number): void;
  /** More of the book counted: the page said again. */
  counted(): void;
  /** No words in sight measured yet (a chapter on its way, or refused): no page said until they are. */
  clear(): void;
  /** The page `offset` into spine item `spine` is on, as its label says it; null for none known. */
  labelAt(spine: number, offset: number): string | null;
  /** The book's bookmarks changed: the strip shows them. */
  listed(): void;
}

export function bookPlace(of: BookPlaceOf): BookPlace {
  const { page } = of;
  /** The first of the words in sight, as last measured in the chapter drawn; null before they are. */
  let from: number | null = null;

  /** The book the strip last drew: another, and it's drawn anew. */
  let drew: Epub | null = null;
  /** The place as a share of the book, as last told. */
  let share = 0;
  /** A place's page and the book's pages; none known for a printed book's chapter not yet counted. */
  const pageIn = (spine: number, offset: number) => {
    const count = of.count();
    // A printed page there isn't known until its chapter is counted: the one before would be wrong.
    if (!count || (count.print.length > 0 && count.lengths[spine] === null))
      return { label: null, of: null };
    return pageOf(count, spine, offset);
  };
  const labelAt = (spine: number, offset: number) => {
    const { label } = pageIn(spine, offset);
    return label === null ? null : String(label);
  };
  const pageAt = (spine: number, offset: number) => {
    const { label, of: total } = pageIn(spine, offset);
    return pageWords(label, total);
  };
  const strip = bookStrip({ ...of, pageAt });
  const say = () => {
    const count = of.count();
    const { label, of: total } =
      count && from !== null ? pageOf(count, of.spine(), from) : { label: null, of: null };
    page.foot.page(pageWords(label, total));
  };

  return {
    moved(fraction) {
      const epub = of.epub();
      const book = epub ? bookFraction(epub.spine, of.spine(), fraction) : 0;
      page.foot.through(fraction, book);
      const { at, of: count } = page.sheet.page;
      page.edges.through(book, at, count);
      if (epub !== drew) {
        drew = epub;
        strip.drawn();
      }
      share = book;
      strip.place(share, from ?? 0);
      // Only when it changes: setting it again restyles the page, and this is told every scroll frame.
      const after = String(page.edges.after);
      if (page.leaf.style.getPropertyValue('--edges-after') !== after)
        page.leaf.style.setProperty('--edges-after', after);
    },
    inSight(start) {
      from = start;
      say();
      strip.place(share, start);
    },
    counted() {
      say();
      strip.drawn();
      // Its page known now: the slider says it.
      strip.place(share, from ?? 0);
    },
    clear() {
      from = null;
      say();
    },
    labelAt,
    listed: () => strip.drawn(),
  };
}
