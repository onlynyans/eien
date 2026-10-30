// What a book's page says of where it is (#40), as the place moves: how far
// through the chapter and the book in the colophon and the fore-edge (Phase
// 2, 3b), and the page the place is on (Phase 4: the printed edition's,
// else a steady one, ./book-count.ts), told as the words in sight are
// measured and again as the count comes in.

import { bookFraction, type Epub, pageOf, pageWords } from '../../core/epub';
import type { BookCount } from './book-count';
import type { EpubPage } from './epub-page';

export interface BookPlaceOf {
  readonly page: EpubPage;
  epub(): Epub | null;
  /** The spine item drawn. */
  spine(): number;
  /** The book's count, while one is open. */
  count(): BookCount | null;
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
}

export function bookPlace(of: BookPlaceOf): BookPlace {
  const { page } = of;
  /** The first of the words in sight, as last measured in the chapter drawn; null before they are. */
  let from: number | null = null;

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
      // Only when it changes: setting it again restyles the page, and this is told every scroll frame.
      const after = String(page.edges.after);
      if (page.leaf.style.getPropertyValue('--edges-after') !== after)
        page.leaf.style.setProperty('--edges-after', after);
    },
    inSight(start) {
      from = start;
      say();
    },
    counted: say,
    clear() {
      from = null;
      say();
    },
    labelAt(spine, offset) {
      const count = of.count();
      const { label } = count ? pageOf(count, spine, offset) : { label: null };
      return label === null ? null : String(label);
    },
  };
}
