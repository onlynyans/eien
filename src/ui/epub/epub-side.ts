// One page holding an EPUB (#40), as the pages controller holds any page
// (../vault/page-side.ts): the book read from the vault and opened by
// core/epub, one chapter drawn at a time, and the place in the book (its
// chapter, and the line in it, Phase 2) kept in the reading state's file
// whenever the writer moves to another chapter or the page comes to rest;
// words chosen in it quoted in a note (Phase 2c); the book counted for its
// page numbers (Phase 4, ./book-count.ts); and its bookmarks
// (./page-bookmarks.ts). The book's file is only ever
// read. What a side is: ./epub-side-types.ts.

import { DEFAULT_SETTINGS, type SettingValues } from '../../core/config';
import { type Epub, isRefusal, refusalWords } from '../../core/epub';
import { crumbsOf } from '../vault/open-note';
import type { Place, SideHooks } from '../vault/page-side';
import type { BookCount } from './book-count';
import { bookFollow } from './book-follow';
import { nameLinks } from './book-links';
import { nameOf, openBook, startOf } from './book-open';
import { bookPages } from './book-pages';
import { bookPlace } from './book-place';
import { quoteOf } from './book-quote';
import { chapterFoot } from './chapter-foot';
import { type DrawnChapter, drawChapter } from './chapter-view';
import { EpubPage } from './epub-page';
import type { EpubPlace, EpubSide, EpubSideOf } from './epub-side-types';
import { PageBookmarks } from './page-bookmarks';

export function makeEpubSide(of: EpubSideOf, hooks: SideHooks, left: Place | null): EpubSide {
  const page = new EpubPage({
    close: hooks.close,
    moved: (fraction) => placing.moved(fraction),
    inSight: (from, to) => {
      placing.inSight(from, to);
      marks.inSight(from, to);
    },
    bookmark: () => void bookmark(),
    turn: (way, held) => pages.turn(way, held),
    edge: (last) => pages.edge(last),
    rested: (offset) => keep(offset),
    follow: (anchor, link) => void links.follow(anchor, link),
    back: () => void links.back(),
    quote: () => void quote(),
  });
  let path: string | null = null;
  let epub: Epub | null = null;
  let spine = -1;
  let drawn: DrawnChapter | null = null;
  /** The book's count for its page numbers, and how to stop asking for the rest of it. */
  let count: BookCount | null = null;
  let stopCount = () => {};
  let before = left;
  let disposed = false;
  /** The shelf's settings, as last followed. */
  let values: SettingValues = DEFAULT_SETTINGS;
  /** Counts what the page was asked to show, so a slow open never lands over a newer one. */
  let turn = 0;

  /** No more of the book counted for this page. */
  const stopCounting = () => {
    stopCount();
    stopCount = () => {};
  };
  const letGo = () => {
    drawn?.release();
    drawn = null;
    stopCounting();
    count = null;
    marks.clear();
  };
  const placing = bookPlace({ page, epub: () => epub, spine: () => spine, count: () => count });
  const marks = new PageBookmarks({
    page,
    store: of.reading,
    chapter: () => (spine >= 0 ? (epub?.spine[spine]?.path ?? null) : null),
    still: (then) => pages.whenStill(then),
    land: () => pages.finish(),
    changed: () => of.looks(),
    listed: () => of.changed(),
  });
  const bookmark = () => marks.toggle();
  /** No words in sight measured in the chapter drawn yet: no page said, no bookmark shown. */
  const unplaced = () => {
    placing.clear();
    marks.away();
  };
  const links = bookFollow({
    page,
    epub: () => epub,
    spine: () => spine,
    place: () => side.place,
    draw: (index, at) => draw(index, true, at),
    open: (place) => side.open(place.path, place),
    keep: (offset) => keep(offset),
  });

  const pages = bookPages({
    page,
    epub: () => epub,
    spine: () => spine,
    draw: (index, at) => draw(index, true, at),
    values: () => values,
  });

  /** The place in the book kept in its reading state: each write reads the vault again, so only at a rest. */
  function keep(offset: number): void {
    const item = epub?.spine[spine];
    if (epub && item) void of.reading.write(epub.key, { chapter: item.path, offset });
  }

  /**
   * The spine item `index` drawn at `place` in its words (or the place it
   * gives once drawn: a link's), kept as the place if `kept` and it's another
   * chapter; false when it was refused, or something else asked for meanwhile.
   */
  async function draw(
    index: number,
    kept: boolean,
    place: number | (() => number) = 0,
  ): Promise<boolean> {
    const opened = epub;
    if (!opened || !path) return false;
    pages.finish();
    const asked = ++turn;
    const chapter = await opened.chapter(index);
    if (asked !== turn || disposed) return false;
    if (isRefusal(chapter)) {
      unplaced();
      page.notice(refusalWords(chapter));
      return false;
    }
    count?.add(index, chapter);
    const next = await drawChapter(opened, chapter);
    if (asked !== turn || disposed) {
      next.release();
      return false;
    }
    // The chapter left's pictures let go once no turn shows a copy of its page.
    const left = drawn;
    pages.whenStill(() => left?.release());
    drawn = next;
    const moved = kept && index !== spine;
    spine = index;
    const given = typeof place === 'number' ? place : 0;
    // The last chapter's words in sight aren't this one's: its page is said once they're measured.
    unplaced();
    page.drawn(
      next.element,
      chapterFoot(opened, index, turnTo),
      `${index + 1} of ${opened.spine.length}`,
      given,
    );
    nameLinks(page.chapter, opened);
    const offset = typeof place === 'number' ? place : place();
    if (offset !== given) page.sheet.showPlace(offset);
    of.changed();
    if (moved) keep(offset);
    if (offset > 0 || typeof place === 'function') {
      // The pictures at their size and the type loaded, then the line: shown where it will stay.
      // A place given once drawn (a chapter's last page) is asked for again, the pages now settled.
      await next.settled(page.chapter);
      if (asked === turn && !disposed)
        page.sheet.showPlace(typeof place === 'function' ? place() : offset);
    }
    return asked === turn && !disposed;
  }

  /**
   * The words chosen in the chapter now (or, from a phone's ⋯, `kept`: last
   * chosen there) quoted in the note beside, with where they came from; once:
   * the selection goes with it. What happened is said here, unless the page
   * gave its place to the note (a phone's one page), which says it there.
   */
  async function quote(kept = false): Promise<void> {
    const text = quoteOf(kept ? page.sheet.kept : page.sheet.selection, epub, spine, page.name);
    if (!text) return page.foot.say('Choose some words in the book to quote.');
    const done = await of.quote(text, side);
    if ('into' in done) document.getSelection()?.removeAllRanges();
    if (!disposed) page.foot.say('into' in done ? `Quoted in ${done.into}.` : done.not);
  }

  /** A chapter chosen at the foot: drawn, the keyboard staying on the page (its button is gone). */
  const turnTo = (index: number) =>
    void side.go(index).then(() => {
      if (!disposed) page.focus();
    });

  const side: EpubSide = {
    kind: 'epub',
    page,
    get path() {
      return path;
    },
    get epub() {
      return epub;
    },
    get spine() {
      return spine;
    },
    // The place now: a scroll still on its way to rest (a quote, ⇄, a page taking this one's slot
    // within the second) is kept first, while the page is laid out.
    get place(): EpubPlace | null {
      if (!path) return null;
      page.sheet.keep();
      return { path, name: page.name, spine, offset: page.sheet.place };
    },
    get left() {
      return before;
    },
    async open(next, place) {
      if (disposed) return;
      // A place left while the book was loading, or refused, has no chapter: it opens where it was kept.
      const given = place?.path === next && 'spine' in place ? (place as EpubPlace) : null;
      const at = given && given.spine >= 0 ? given.spine : null;
      const offset = given?.offset ?? 0;
      if (next === path && epub) {
        if (at !== null && at !== spine) await draw(at, true, offset);
        else if (at !== null && offset !== page.sheet.place) page.sheet.showPlace(offset);
        return;
      }
      if (path && path !== next) before = side.place;
      links.forget();
      const opening = ++turn;
      path = next;
      epub = null;
      spine = -1;
      letGo();
      page.loading(nameOf(null, next), crumbsOf(next));
      const read = await openBook(of, next);
      if (opening !== turn || disposed) return;
      if ('notice' in read) {
        page.notice(read.notice);
        return of.changed();
      }
      epub = read.epub;
      const counted = of.counts.of(epub);
      count = counted;
      page.show(nameOf(epub, next), crumbsOf(next), epub.language);
      // Its bookmarks whatever place it opens at (⇄, a second page); the place kept only if none was given.
      const state = await of.reading.read(epub.key);
      if (opening !== turn || disposed) return;
      marks.opened(epub.key, state);
      const start = startOf(epub, at === null ? null : { spine: at, offset }, state.reading);
      await draw(start.index, false, start.offset);
      // The rest counted once the chapter's in sight, counted as it was drawn, never parsed first;
      // not if another book came meanwhile (a draw moves `turn` on, so the book is what's asked).
      if (disposed || epub !== read.epub) return;
      stopCount = counted.run(
        epub,
        (then) => pages.whenStill(then),
        () => placing.counted(),
      );
    },
    go: async (index) => {
      // A chapter the reader chose: no step back to where a link was followed from.
      links.forget();
      await draw(index, true);
    },
    reload() {
      const here = side.place;
      epub = null;
      return here ? side.open(here.path, here) : Promise.resolve();
    },
    moved(to) {
      path = to;
      // A book with no title of its own is called by its file: renamed, its new name.
      page.show(nameOf(epub, to), crumbsOf(to), epub?.language ?? '');
    },
    clear() {
      links.forget();
      turn++;
      path = null;
      epub = null;
      spine = -1;
      letGo();
      page.nothing();
    },
    keep: () => page.sheet.keep(),
    get bookmarked() {
      return marks.on;
    },
    get bookmarks() {
      return marks.all;
    },
    bookmark,
    unmark: (mark) => marks.remove(mark),
    labelAt: (at, offset) => placing.labelAt(at, offset),
    quote,
    follow(next) {
      values = next;
      // A new look or view lays the page out anew: the turn in flight lands first.
      pages.finish();
      page.wear(next);
    },
    dispose() {
      disposed = true;
      // The count stopped first: the turn's dispose runs what waits for it to be still.
      stopCounting();
      pages.dispose();
      links.forget();
      letGo();
      page.dispose();
    },
  };
  return side;
}
