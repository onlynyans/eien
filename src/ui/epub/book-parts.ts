// The parts of a page holding a book (#40), made together for its side
// (./epub-side.ts): what it says of where it is (./book-place.ts), its
// bookmarks (./page-bookmarks.ts), the links it follows (./book-follow.ts)
// and its turns (./book-pages.ts), each asking the side for the book, the
// chapter drawn, and another drawn.

import type { SettingValues } from '../../core/config';
import type { Epub } from '../../core/epub';
import type { BookCount } from './book-count';
import { bookFollow } from './book-follow';
import { bookPages } from './book-pages';
import { bookPlace } from './book-place';
import type { EpubPage } from './epub-page';
import type { EpubSide, EpubSideOf } from './epub-side-types';
import { PageBookmarks } from './page-bookmarks';

export interface BookPartsOf {
  readonly page: EpubPage;
  readonly of: EpubSideOf;
  epub(): Epub | null;
  /** The spine item drawn. */
  spine(): number;
  count(): BookCount | null;
  /** The shelf's settings now. */
  values(): SettingValues;
  side(): EpubSide;
  /** The spine item `index` drawn at a place, kept as the place; false if refused. */
  draw(index: number, at: number | (() => number)): Promise<boolean>;
  /** The place kept in the reading state. */
  keep(offset: number): void;
}

export function bookParts(parts: BookPartsOf) {
  const { page, of, epub, spine, side } = parts;
  /** What the parts ask of the page: the book, the chapter drawn, and another drawn (kept as the place). */
  const book = { page, epub, spine, draw: parts.draw };
  const placing = bookPlace({
    ...book,
    count: parts.count,
    marks: () => marks.all,
    goTo: (index, at) => void side().goTo(index, at),
  });
  const marks = new PageBookmarks({
    page,
    store: of.reading,
    chapter: () => (spine() >= 0 ? (epub()?.spine[spine()]?.path ?? null) : null),
    still: (then) => pages.whenStill(then),
    land: () => pages.finish(),
    changed: () => of.looks(),
    listed: () => {
      of.changed();
      placing.listed();
    },
  });
  const links = bookFollow({
    ...book,
    place: () => side().place,
    open: (place) => side().open(place.path, place),
    keep: parts.keep,
  });
  const pages = bookPages({ ...book, values: parts.values });
  return {
    placing,
    marks,
    links,
    pages,
    /** No words in sight measured in the chapter drawn yet: no page said, no bookmark shown. */
    unplaced: () => {
      placing.clear();
      marks.away();
    },
  };
}
