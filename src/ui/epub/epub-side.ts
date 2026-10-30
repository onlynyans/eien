// One page holding an EPUB (#40), as the pages controller holds any page
// (../vault/page-side.ts): the book read from the vault and opened by
// core/epub, one chapter drawn at a time, and the place in the book (its
// chapter, and the line in it, Phase 2) kept in the reading state's file
// whenever the writer moves to another chapter or the page comes to rest.
// The book's file is only ever read.

import {
  bookFraction,
  EPUB_CAPS,
  type Epub,
  isRefusal,
  openEpub,
  refusalWords,
} from '../../core/epub';
import { baseName } from '../../core/paths';
import { epubTitleOf } from '../../core/vault';
import type { VaultBridge } from '../../platform/bridge';
import { inflateRaw } from '../../platform/inflate';
import { crumbsOf } from '../vault/open-note';
import type { Place, Side, SideHooks } from '../vault/page-side';
import { bookFollow } from './book-follow';
import { nameLinks } from './book-links';
import { chapterFoot } from './chapter-foot';
import { type DrawnChapter, drawChapter } from './chapter-view';
import { EpubPage } from './epub-page';
import type { ReadingStore } from './reading-store';

/** Where an EPUB's page was: the chapter it showed, by its place in the spine, and the line in it. */
export interface EpubPlace extends Place {
  readonly spine: number;
  /** An offset in the chapter's words (core/epub/place.ts): its first line in sight. */
  readonly offset: number;
}

export interface EpubSideOf {
  readonly vault: Pick<VaultBridge, 'readBytes'>;
  readonly reading: ReadingStore;
  /** The size the vault lists for `path`, or null for none: a book listed past the read cap is too large. */
  sizeOf(path: string): number | null;
  /** Another book or chapter is on the page: the list and the shelf mark it. */
  changed(): void;
}

export interface EpubSide extends Side {
  readonly kind: 'epub';
  readonly page: EpubPage;
  readonly place: EpubPlace | null;
  /** The book open, or null with none (or one that wouldn't open). */
  readonly epub: Epub | null;
  /** The spine item drawn; -1 for none. */
  readonly spine: number;
  /** Draw the spine item `index`, and keep it as the place to come back to. */
  go(index: number): Promise<void>;
  /** The book's file moved (a folder above it renamed or moved by this window): the page follows it. */
  moved(to: string): void;
  /** Read the book again, where the page was in it: its file changed on disk. */
  reload(): Promise<void>;
  /** Its place, if on its way to rest, kept now: the window is quitting. */
  keep(): void;
}

/**
 * The fonts `chapter` is set in loaded, so a line shown now stays there: laid
 * out first, as a face starts loading only when something asks for it (one
 * arriving later shows the place again, ./place-keeper.ts).
 */
const fontsLoaded = (chapter: HTMLElement): Promise<unknown> => {
  void chapter.offsetHeight;
  return typeof document.fonts === 'object' && document.fonts.status !== 'loaded'
    ? document.fonts.ready
    : Promise.resolve();
};

/** Whether `side` holds an EPUB: a page of this kind, not a test's stand-in of the same name. */
export const isEpub = (side: Side | null | undefined): side is EpubSide =>
  side?.kind === 'epub' && 'go' in side;

/** What a book's page is called: its own title, or with none its file's name. */
const nameOf = (epub: Epub, path: string): string => epub.title || epubTitleOf(baseName(path));

export function makeEpubSide(of: EpubSideOf, hooks: SideHooks, left: Place | null): EpubSide {
  const page = new EpubPage({
    close: hooks.close,
    moved: (fraction) =>
      page.through(fraction, epub ? bookFraction(epub.spine, spine, fraction) : 0),
    rested: (offset) => keep(offset),
    follow: (anchor, link) => void links.follow(anchor, link),
    back: () => void links.back(),
  });
  let path: string | null = null;
  let epub: Epub | null = null;
  let spine = -1;
  let drawn: DrawnChapter | null = null;
  let before = left;
  let disposed = false;
  /** Counts what the page was asked to show, so a slow open never lands over a newer one. */
  let turn = 0;

  const letGo = () => {
    drawn?.release();
    drawn = null;
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
    const asked = ++turn;
    const chapter = await opened.chapter(index);
    if (asked !== turn || disposed) return false;
    if (isRefusal(chapter)) {
      page.notice(refusalWords(chapter));
      return false;
    }
    const next = await drawChapter(opened, chapter);
    if (asked !== turn || disposed) {
      next.release();
      return false;
    }
    letGo();
    drawn = next;
    const moved = kept && index !== spine;
    spine = index;
    const given = typeof place === 'number' ? place : 0;
    page.drawn(
      next.element,
      chapterFoot(opened, index, turnTo),
      `${index + 1} of ${opened.spine.length}`,
      given,
    );
    nameLinks(page.chapter, opened);
    const offset = typeof place === 'number' ? place : place();
    if (offset !== given) page.showPlace(offset);
    of.changed();
    if (moved) keep(offset);
    if (offset > 0) {
      // The pictures at their size and the type loaded, then the line: shown where it will stay.
      await Promise.all([next.settled(), fontsLoaded(page.chapter)]);
      if (asked === turn && !disposed) page.showPlace(offset);
    }
    return asked === turn && !disposed;
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
    get place(): EpubPlace | null {
      return path ? { path, name: page.name, spine, offset: page.place } : null;
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
        else if (at !== null && offset !== page.place) page.showPlace(offset);
        return;
      }
      if (path && path !== next) before = side.place;
      links.forget();
      const opening = ++turn;
      path = next;
      epub = null;
      spine = -1;
      letGo();
      page.loading(epubTitleOf(baseName(next)), crumbsOf(next));
      const bytes = await of.vault.readBytes(next).catch(() => null);
      if (opening !== turn || disposed) return;
      if (!bytes) {
        const size = of.sizeOf(next);
        page.notice(
          size === null
            ? 'This book isn’t there any more.'
            : size > EPUB_CAPS.file
              ? refusalWords({ refused: 'too-large', detail: '' })
              : 'This book couldn’t be read. Try again in a moment.',
        );
        return of.changed();
      }
      const opened = await openEpub(bytes, inflateRaw);
      if (opening !== turn || disposed) return;
      if (isRefusal(opened)) {
        console.warn(`Eien: ${next} wasn’t opened: ${opened.detail}`);
        page.notice(refusalWords(opened));
        return of.changed();
      }
      epub = opened;
      page.show(nameOf(opened, next), crumbsOf(next), opened.language);
      const kept = at === null ? await of.reading.read(opened.key) : null;
      if (opening !== turn || disposed) return;
      const fromState = kept?.chapter
        ? opened.spine.findIndex((item) => item.path === kept.chapter)
        : -1;
      const first = opened.contents[0]?.spine ?? 0;
      const valid = at !== null && at < opened.spine.length ? at : null;
      if (valid !== null) await draw(valid, false, offset);
      else if (fromState >= 0) await draw(fromState, false, kept?.offset ?? 0);
      else await draw(first, false);
    },
    go: async (index) => {
      // A chapter the reader chose: no step back to where a link was followed from.
      links.forget();
      await draw(index, true);
    },
    reload() {
      const place = side.place;
      epub = null;
      return place ? side.open(place.path, place) : Promise.resolve();
    },
    moved(to) {
      path = to;
      // A book with no title of its own is called by its file: renamed, its new name.
      page.show(epub ? nameOf(epub, to) : page.name, crumbsOf(to), epub?.language ?? '');
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
    keep: () => page.keepPlace(),
    follow: (values) => page.wear(values),
    dispose() {
      disposed = true;
      links.forget();
      letGo();
      page.dispose();
    },
  };
  return side;
}
