// A book's Found (#40, Phase 5c; Features 2): the list's own field searching
// the book its contents show, every match a row (../list/found-rows.ts).
// One search for the window, over the chapters it has read for Find
// (../epub/book-search.ts); asked again only when the book or the words
// change, so drawing the list as matches arrive never starts it over.
// Typing turns the list to Found, clearing it back to Contents.

import { AS_WRITTEN, chapterTitle, type Epub, matcherOf, walkPlaces } from '../../core/epub';
import { BookSearch, type BookTexts } from '../epub/book-search';
import type { EpubSide } from '../epub/epub-side-types';
import type { FoundModel } from '../list/found-rows';
import type { Navigation } from './navigation';

/** The fewest characters the list's field searches a book for: two (Features 2), not every letter. */
export const FOUND_FROM = 2;

export interface EpubFoundOf {
  readonly texts: BookTexts;
  readonly nav: Navigation;
  /** Matches arrived: the panes showing them draw again. */
  redraw(): void;
}

export interface EpubFound {
  /** The field's words now: the list turns to Found with some, back to Contents with none. */
  typed(words: string): void;
  /** Found for the book on `side` with the field's `words`; null for no search (too few letters). */
  model(side: EpubSide, epub: Epub, words: string): FoundModel | null;
  /** Enter in the field (⇧Enter back): the next match past the place, shown; false for none. */
  step(side: EpubSide, way: 1 | -1): boolean;
}

/** The words worth searching a book for, or null. */
const wanted = (words: string): string | null => {
  const trimmed = words.trim();
  return trimmed.length >= FOUND_FROM ? trimmed : null;
};

export function epubFound(of: EpubFoundOf): EpubFound {
  /** An Enter pressed before the words' first match arrived: taken once one has. */
  let waiting: { readonly side: EpubSide; readonly way: 1 | -1 } | null = null;
  const search = new BookSearch({
    texts: of.texts,
    changed: () => {
      const step = waiting;
      if (step && (search.found.length > 0 || search.done)) {
        waiting = null;
        go(step.side, step.way);
      }
      of.redraw();
    },
  });
  /** The book and words searched now. */
  let asked: { readonly key: string; readonly words: string } | null = null;

  /** The next match past the place on `side` (or the one before), shown and said. */
  const go = (side: EpubSide, way: 1 | -1): boolean => {
    const { found } = search;
    const from = side.page.sheet.place;
    const walk = walkPlaces(
      found,
      (match) => ({ spine: match.spine, offset: match.from }),
      { spine: side.spine, from, to: from + 1 },
      way,
    );
    if (!walk) return false;
    void side.find.goToMatch(walk.to);
    side.page.foot.say(`Match ${walk.index + 1} of ${found.length}.`);
    return true;
  };

  return {
    typed(words) {
      const { nav } = of;
      // Other words: the last ones' matches let go at once, so Enter never walks them.
      if (asked && asked.words !== wanted(words)) {
        asked = null;
        waiting = null;
        search.clear();
      }
      if (wanted(words)) nav.bookLens = 'found';
      else if (nav.bookLens === 'found') nav.bookLens = 'contents';
    },
    model(side, epub, words) {
      const looked = wanted(words);
      if (!looked) {
        asked = null;
        search.clear();
        return null;
      }
      if (asked?.key !== epub.key || asked.words !== looked) {
        asked = { key: epub.key, words: looked };
        // As written, any case: the find bar's options are the bar's (../epub/book-find.ts).
        const matcher = matcherOf(looked, AS_WRITTEN);
        search.search(epub, matcher === 'invalid' ? null : matcher, side.whenStill);
      }
      return {
        rows: search.found.map((match) => ({
          ...match,
          page: side.labelAt(match.spine, match.from),
          chapter: chapterTitle(epub.contents, match.spine) ?? side.page.name,
        })),
        words: looked,
        title: side.page.name,
        searched: search.searched,
        chapters: epub.spine.length,
        done: search.done,
        more: search.more,
      };
    },
    step(side, way) {
      if (go(side, way)) return true;
      // The words' search on its way (or yet to start, as the list draws): the first match it finds.
      if (!asked || !search.done) {
        waiting = { side, way };
        return true;
      }
      return false;
    },
  };
}
