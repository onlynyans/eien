// A book's Found (#40, Phase 5c; Features 2): the list's own field searching
// the book its contents show, every match a row (../list/found-rows.ts).
// One search for the window, over the chapters it has read for Find
// (../epub/book-search.ts). The panes sync it before they draw (`sync`):
// asked again only when the book or the words change, so drawing the rows
// as matches arrive never starts it over, and stopped once no rows are in
// sight to show it. Reading what it found (`model`) changes nothing. Typing
// turns the list to Found, clearing it back to Contents; the result is said
// once, in the book's colophon, as the list's line is never announced.

import { AS_WRITTEN, chapterTitle, type Epub, matcherOf } from '../../core/epub';
import { COUNT_LIMIT } from '../../core/find';
import { BookSearch, type BookTexts } from '../epub/book-search';
import type { EpubSide } from '../epub/epub-side-types';
import type { Still } from '../epub/still';
import type { FoundModel } from '../list/found-rows';
import type { Navigation } from './navigation';

/** The fewest characters the list's field searches a book for: two (Features 2), not every letter. */
export const FOUND_FROM = 2;

export interface EpubFoundOf {
  readonly texts: BookTexts;
  readonly nav: Navigation;
  /** `then` once no page of the window's turns. */
  readonly still: Still;
  /** Matches arrived: the panes showing them draw again. */
  redraw(): void;
}

export interface EpubFound {
  /** The field's words now, searching a book: the list turns to Found with some, back to Contents with none. */
  typed(words: string): void;
  /** Before the panes draw: the search for the book on `side` and `words` (both null: no rows in sight, stopped). */
  sync(side: EpubSide | null, words: string | null): void;
  /** Whether the search of the book `key` found anything in spine item `spine` (a row there to name, #67). */
  foundIn(key: string, spine: number): boolean;
  /** What's found in the book on `side`, as its rows show it; null for no search of it. */
  model(side: EpubSide, epub: Epub): FoundModel | null;
  /** Enter in the field (⇧Enter back): the next match past the place, shown; false for none. */
  step(side: EpubSide, way: 1 | -1): boolean;
}

/** The words worth searching a book for, or null. */
const wanted = (words: string): string | null => {
  const trimmed = words.trim();
  return trimmed.length >= FOUND_FROM ? trimmed : null;
};

/** What the colophon says once a search is through. */
function result(found: number, more: boolean, words: string): string {
  if (found === 0) return `No “${words}” in this book.`;
  if (more) return `More than ${COUNT_LIMIT.toLocaleString('en')} for “${words}”.`;
  return `${found.toLocaleString('en')} ${found === 1 ? 'match' : 'matches'} for “${words}”.`;
}

export function epubFound(of: EpubFoundOf): EpubFound {
  /** The book and words searched now, and the page it's said on. */
  let asked: { readonly key: string; readonly words: string; readonly side: EpubSide } | null =
    null;
  /** An Enter pressed before the search had looked where it goes: taken once it has, on that book alone. */
  let waiting: { readonly key: string; readonly side: EpubSide; readonly way: 1 | -1 } | null =
    null;
  /** Whether the search's result was said, or a match gone to said more: its own place among them. */
  let said = false;
  const search = new BookSearch({
    texts: of.texts,
    changed: () => {
      const step = waiting;
      if (step && step.key === asked?.key) {
        waiting = null;
        go(step.side, step.way);
      }
      if (search.done && asked && !said) {
        said = true;
        asked.side.page.foot.say(result(search.found.length, search.more, asked.words));
      }
      of.redraw();
    },
  });

  /** Nothing searched, and nothing waiting. */
  const stop = () => {
    asked = null;
    waiting = null;
    search.clear();
  };

  /** The next match past the place on `side` (or the one before), shown and said; false for none. */
  const go = (side: EpubSide, way: 1 | -1): boolean => {
    const from = side.page.sheet.place;
    const walk = search.walk(side.spine, from, way);
    if (walk === null) return false;
    if (walk === 'wait') {
      waiting = asked && { key: asked.key, side, way };
      return waiting !== null;
    }
    // Painted, not chosen: the field keeps the keyboard and its words.
    void side.find.goToMatch(walk.to, false);
    side.page.foot.say(`Match ${walk.index + 1} of ${search.found.length}.`);
    said = true;
    return true;
  };

  return {
    typed(words) {
      const { nav } = of;
      if (asked && asked.words !== wanted(words)) stop();
      if (wanted(words)) nav.bookLens = 'found';
      else if (nav.bookLens === 'found') nav.bookLens = 'contents';
    },
    sync(side, words) {
      const epub = side?.epub;
      const looked = words === null ? null : wanted(words);
      if (!side || !epub || !looked) {
        if (asked) stop();
        return;
      }
      if (asked?.key === epub.key && asked.words === looked) return;
      stop();
      asked = { key: epub.key, words: looked, side };
      said = false;
      // As written, any case: the find bar's options are the bar's (../epub/book-find.ts).
      const matcher = matcherOf(looked, AS_WRITTEN);
      search.search(epub, matcher === 'invalid' ? null : matcher, of.still);
    },
    foundIn: (key, spine) =>
      asked?.key === key && search.found.some((match) => match.spine === spine),
    model(side, epub) {
      if (!asked || asked.key !== epub.key) return null;
      return {
        rows: search.found.map((match) => ({
          ...match,
          page: side.labelAt(match.spine, match.from),
          chapter: chapterTitle(epub.contents, match.spine) ?? side.page.name,
        })),
        words: asked.words,
        title: side.page.name,
        searched: search.searched,
        chapters: epub.spine.length,
        done: search.done,
        more: search.more,
      };
    },
    step(side, way) {
      if (!asked || asked.key !== side.epub?.key) return false;
      return go(side, way);
    },
  };
}
