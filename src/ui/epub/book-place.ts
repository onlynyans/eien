// What a book's page says of where it is (#40), as the place moves: how far
// through the book in the colophon and the fore-edge (Phase 2, 3b); where in
// the chapter (#67): the printed edition's page where the book has a
// page-list (core/epub/page-numbers.ts, counted by ./book-count.ts), else the
// chapter's own pages as they're laid out now, else, scrolling, how far
// through it; the folios the same numbers; told as the words in sight are
// measured, and again as the count comes in; and the whole book down the
// page's edge (Phase 4d, ./book-strip.ts). In pages (Phase 3d), a spread's
// two pages, the running heads and folios, and the imprint's figures;
// nothing of the book's on its front matter.

import {
  bookFraction,
  bookWords,
  chapterWords,
  type Epub,
  type Mark,
  pageWords,
  placeLabel,
  placeWords,
  printPages,
  spreadWords,
} from '../../core/epub';
import type { BookCount } from './book-count';
import { bookStrip } from './book-strip';
import type { EpubPage } from './epub-page';
import { fillImprint } from './front-matter';
import { allFront, holdsWords, type PageShown } from './sight';

export interface BookPlaceOf {
  readonly page: EpubPage;
  epub(): Epub | null;
  /** The spine item drawn. */
  spine(): number;
  /** The book's count, while one is open. */
  count(): BookCount | null;
  /** The book's marks, bookmarks and highlights in its order, for the strip. */
  marks(): readonly Mark[];
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
  /** Where `offset` into spine item `spine` is, as a row says it: its printed page, else "21%"; null for none known. */
  labelAt(spine: number, offset: number): string | null;
  /** The book's bookmarks changed: the strip shows them. */
  listed(): void;
}

export function bookPlace(of: BookPlaceOf): BookPlace {
  const { page } = of;
  /** The first of the words in sight, as last measured in the chapter drawn; null before they are. */
  let from: number | null = null;
  /** How far through the chapter, as last told. */
  let fraction = 0;

  /** The book the strip last drew: another, and it's drawn anew. */
  let drew: Epub | null = null;
  /** The place as a share of the book, as last told. */
  let share = 0;
  /** The count, where the book numbers its pages by the printed edition's. */
  const printed = () => {
    const count = of.count();
    return count && count.print.length > 0 ? count : null;
  };
  const labelAt = (spine: number, offset: number) => {
    const count = of.count();
    const epub = of.epub();
    return count && epub ? placeLabel(count, epub.spine, spine, offset) : null;
  };
  /**
   * A page in sight's number, `at` in the sight: its printed page's label,
   * else its page in the chapter (1 the opening's) as the chapter is laid out
   * now, so a turn moves it on by one. Null for none known yet.
   */
  const numberOf = (shown: PageShown, at: number): string | null =>
    printed() ? labelAt(of.spine(), shown.from) : String(page.sheet.page.at + at + 1);
  /** Where in the chapter, as the colophon says it; '' for none known (no words in sight measured, the front matter). */
  const inChapter = (): string => {
    const { sight } = page.sheet;
    if (from === null || allFront(sight)) return '';
    const count = printed();
    if (!page.sheet.paged)
      return count
        ? pageWords(labelAt(of.spine(), from), printPages(count.print))
        : chapterWords(fraction);
    const [verso, recto] = sight;
    return spreadWords(
      holdsWords(verso) ? numberOf(verso, 0) : null,
      holdsWords(recto) ? numberOf(recto, 1) : null,
      count ? printPages(count.print) : page.sheet.page.of,
    );
  };
  const strip = bookStrip({
    ...of,
    wordsAt(spine, offset, at) {
      const count = printed();
      const epub = of.epub();
      return count && epub ? placeWords(count, epub.spine, spine, offset) : bookWords(at);
    },
  });
  /** The page in sight said, a spread's two; the heads and folios over and under it; the imprint's figures. */
  const say = () => {
    // None measured yet (a chapter on its way): the last one's sight isn't this chapter's.
    const sight = from === null ? [] : page.sheet.sight;
    const spine = of.spine();
    page.foot.page(inChapter());
    page.heads.show(sight, of.epub(), spine, numberOf);
    const epub = of.epub();
    if (epub && allFront(sight)) {
      const count = printed();
      // Its chapters as the list's head counts them: the contents' rows.
      fillImprint(
        page.chapter,
        page.element,
        epub.contents.length,
        count ? printPages(count.print) : null,
      );
    }
  };

  return {
    moved(through) {
      fraction = through;
      const epub = of.epub();
      const book = epub ? bookFraction(epub.spine, of.spine(), through) : 0;
      page.foot.through(book);
      // Scrolling, how far through the chapter moves with it (a printed page only with the words in
      // sight, measured at rest); in pages a turn says it once its sight is measured.
      if (!page.sheet.paged && !printed()) page.foot.page(inChapter());
      const { at, of: count, per } = page.sheet.page;
      page.edges.through(book, at, count, per);
      if (epub !== drew) {
        drew = epub;
        strip.drawn();
      }
      share = book;
      strip.place(share, from ?? 0);
      // Only when it changes: setting it again restyles the page, and this is told every scroll frame.
      for (const [name, count] of [
        ['--edges-after', page.edges.after],
        ['--edges-before', page.edges.before],
      ] as const) {
        if (page.leaf.style.getPropertyValue(name) !== String(count))
          page.leaf.style.setProperty(name, String(count));
      }
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
