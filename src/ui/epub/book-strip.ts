// A book on its page's edge (#40, Phase 4d): the strip (./edge-strip.ts)
// told the book's chapters (its contents' rows), bookmarks and place as
// shares of it, by its chapters' sizes as the colophon's percent and the
// fore-edge are (core/epub/progress.ts), a bookmark within its chapter once
// that's counted; and what a point on it is, and where it goes. Worn on the
// leaf only with Marks on the edge (./edge-strip.css, data-marks), drawn
// either way; hidden with no book.

import { type Bookmark, bookFraction, chapterTitle, type Epub, placeAt } from '../../core/epub';
import type { BookCount } from './book-count';
import { EdgeStrip } from './edge-strip';
import type { EpubPage } from './epub-page';

export interface BookStripOf {
  readonly page: EpubPage;
  epub(): Epub | null;
  /** The spine item drawn. */
  spine(): number;
  count(): BookCount | null;
  /** The book's bookmarks. */
  marks(): readonly Bookmark[];
  /** A place shown: spine item `index` at an offset, or the one it gives once drawn (its words counted then). */
  goTo(index: number, at: number | (() => number)): void;
  /** The page a place is on, as the colophon says it ("page 12 of 2,450"), or ''. */
  pageAt(spine: number, offset: number): string;
}

export interface BookStrip {
  /** The book's chapters and bookmarks drawn anew (another book, more of it counted, a bookmark). */
  drawn(): void;
  /** The place now: a share of the book, and the first of the words in sight. */
  place(share: number, from: number): void;
}

export function bookStrip(of: BookStripOf): BookStrip {
  /** Spine item `index`'s words, as counted; 0 until they are. */
  const lengthOf = (index: number) => of.count()?.lengths[index] ?? 0;
  /** How far into spine item `index` an offset is, by its count: none counted, its start. */
  const into = (index: number, offset: number) => {
    const length = lengthOf(index);
    return length ? Math.min(1, offset / length) : 0;
  };
  /** What a place is called: its chapter, and its page where one is known. */
  const said = (epub: Epub, index: number, offset: number) => {
    const title = chapterTitle(epub.contents, index) ?? `Section ${index + 1}`;
    const page = of.pageAt(index, offset);
    return page ? `${title}, ${page}` : title;
  };
  /** The strip's chapters: every row of the contents (a part's chapters too), each its spine item's start, in order. */
  const chapters = (epub: Epub) => [...new Set(epub.contents.map((row) => row.spine))];
  /** A place gone to from the strip: shown, the keyboard back on the page (PageDown turns it again). */
  const go = (index: number, at: number | (() => number)) => {
    of.goTo(index, at);
    of.page.focus();
  };
  const strip = new EdgeStrip({
    go(share) {
      const epub = of.epub();
      const at = epub && placeAt(epub.spine, share);
      // Its words, once drawn and counted, give the place.
      if (at) go(at.index, () => Math.floor(at.within * lengthOf(at.index)));
    },
    step(by) {
      const epub = of.epub();
      const starts = epub ? chapters(epub) : [];
      const last = starts.at(-1);
      if (last === undefined) return;
      if (by === 'first') return of.goTo(starts[0] as number, 0);
      if (by === 'last') return of.goTo(last, () => lengthOf(last));
      // The chapter the place is in: the last to start at or before it; -1 before the first (a
      // title page the contents don't name), so ↓ goes to the first.
      const here = starts.reduce((at, start, i) => (start <= of.spine() ? i : at), -1);
      const to = Math.min(starts.length - 1, Math.max(0, here + by));
      // At either end, nowhere further: a slider at its end doesn't move.
      if (to === here || (here === -1 && by < 0)) return;
      of.goTo(starts[to] as number, 0);
    },
    describe(share) {
      const epub = of.epub();
      const at = epub && placeAt(epub.spine, share);
      return epub && at ? said(epub, at.index, Math.floor(at.within * lengthOf(at.index))) : '';
    },
  });
  of.page.element.append(strip.element);

  return {
    drawn() {
      const epub = of.epub();
      strip.element.hidden = !epub;
      if (!epub) return strip.draw({ chapters: [], marks: [] });
      const index = new Map(epub.spine.map((item, i) => [item.path, i]));
      strip.draw({
        chapters: chapters(epub).map((spine) => bookFraction(epub.spine, spine, 0)),
        marks: of.marks().flatMap((mark) => {
          const spine = index.get(mark.chapter);
          return spine === undefined
            ? []
            : [bookFraction(epub.spine, spine, into(spine, mark.offset))];
        }),
      });
    },
    place(share, from) {
      const epub = of.epub();
      // Said from the chapter drawn and its words, never from the share: a chapter wholly in sight
      // ends where the next begins.
      if (epub) strip.place(share, said(epub, of.spine(), from));
    },
  };
}
