// A book on its page's edge (#40, Phase 4d): the strip (./edge-strip.ts)
// told the book's chapters, bookmarks and place as shares of it, by its
// chapters' sizes as the colophon's percent and the fore-edge are
// (core/epub/progress.ts), a bookmark within its chapter once that's counted;
// and what a point on it is, and where it goes. Worn on the leaf only with
// Marks on the edge (./epub.css's data-marks), drawn either way.

import {
  type Bookmark,
  bookFraction,
  chapterBeside,
  chapterTitle,
  type Epub,
  placeAt,
} from '../../core/epub';
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
  /** Spine item `index` drawn, at the place it gives once drawn (its words counted then). */
  draw(index: number, at: () => number): void;
  /** The page a place is on, as its label says it. */
  labelAt(spine: number, offset: number): string | null;
}

export interface BookStrip {
  /** The book's chapters and bookmarks drawn anew (another book, more of it counted, a bookmark). */
  drawn(): void;
  /** The place now, as a share of the book. */
  place(share: number): void;
}

export function bookStrip(of: BookStripOf): BookStrip {
  /** How far into spine item `index` an offset is, by its count: none counted, its start. */
  const into = (index: number, offset: number) => {
    const length = of.count()?.lengths[index] ?? null;
    return length ? Math.min(1, offset / length) : 0;
  };
  const describe = (share: number) => {
    const epub = of.epub();
    const at = epub && placeAt(epub.spine, share);
    if (!epub || !at) return '';
    const title = chapterTitle(epub.contents, at.index) ?? `Section ${at.index + 1}`;
    const length = of.count()?.lengths[at.index] ?? 0;
    const page = of.labelAt(at.index, Math.floor(at.within * length));
    return page === null ? title : `${title} · page ${page}`;
  };
  /** The chapters in the reading order, first to last. */
  const linear = (epub: Epub) => epub.spine.flatMap((item, i) => (item.linear ? [i] : []));
  const strip = new EdgeStrip({
    go(share) {
      const epub = of.epub();
      const at = epub && placeAt(epub.spine, share);
      if (!at) return;
      // Its words, once drawn and counted, give the place.
      of.draw(at.index, () => Math.floor(at.within * (of.count()?.lengths[at.index] ?? 0)));
    },
    step(by) {
      const epub = of.epub();
      if (!epub) return;
      const order = linear(epub);
      let index: number | null =
        by === 'first' ? (order[0] ?? null) : by === 'last' ? (order.at(-1) ?? null) : of.spine();
      for (let n = 0; typeof by === 'number' && index !== null && n < Math.abs(by); n++) {
        const next = chapterBeside(epub.spine, index, by > 0 ? 1 : -1);
        if (next === null) break;
        index = next;
      }
      if (index !== null && index !== of.spine()) of.draw(index, () => 0);
    },
    describe,
  });
  of.page.element.append(strip.element);

  return {
    drawn() {
      const epub = of.epub();
      if (!epub) return strip.draw({ chapters: [], marks: [] });
      const index = new Map(epub.spine.map((item, i) => [item.path, i]));
      const starts = [
        ...new Set(epub.contents.filter((row) => row.depth === 0).map((row) => row.spine)),
      ];
      strip.draw({
        chapters: starts.map((spine) => bookFraction(epub.spine, spine, 0)),
        marks: of.marks().flatMap((mark) => {
          const spine = index.get(mark.chapter);
          return spine === undefined
            ? []
            : [bookFraction(epub.spine, spine, into(spine, mark.offset))];
        }),
      });
    },
    place: (share) => strip.place(share),
  };
}
