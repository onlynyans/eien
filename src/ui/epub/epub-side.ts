// One page holding an EPUB (#40), as the pages controller holds any page
// (../vault/page-side.ts): the book read from the vault and opened by
// core/epub, one chapter drawn at a time, and the chapter kept in the
// reading state's file whenever the writer moves to another. The book's file
// is only ever read.

import { EPUB_CAPS, type Epub, isRefusal, openEpub, refusalWords } from '../../core/epub';
import { baseName } from '../../core/paths';
import { epubTitleOf } from '../../core/vault';
import type { VaultBridge } from '../../platform/bridge';
import { inflateRaw } from '../../platform/inflate';
import { crumbsOf } from '../vault/open-note';
import type { Place, Side, SideHooks } from '../vault/page-side';
import { type DrawnChapter, drawChapter } from './chapter-view';
import { EpubPage } from './epub-page';
import type { ReadingStore } from './reading-store';

/** Where an EPUB's page was: the chapter it showed, by its place in the spine. */
export interface EpubPlace extends Place {
  readonly spine: number;
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
}

/** Whether `side` holds an EPUB: a page of this kind, not a test's stand-in of the same name. */
export const isEpub = (side: Side | null | undefined): side is EpubSide =>
  side?.kind === 'epub' && 'go' in side;

export function makeEpubSide(of: EpubSideOf, hooks: SideHooks, left: Place | null): EpubSide {
  const page = new EpubPage(hooks.close);
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

  async function draw(index: number, keep: boolean): Promise<void> {
    const opened = epub;
    if (!opened || !path) return;
    const asked = ++turn;
    const chapter = await opened.chapter(index);
    if (asked !== turn || disposed) return;
    if (isRefusal(chapter)) {
      page.notice(refusalWords(chapter));
      return;
    }
    const next = await drawChapter(opened, chapter);
    if (asked !== turn || disposed) return next.release();
    letGo();
    drawn = next;
    // Kept only when the chapter changes: each write reads the vault again.
    const moved = keep && index !== spine;
    spine = index;
    page.drawn(next.element, `${index + 1} of ${opened.spine.length}`);
    of.changed();
    const item = opened.spine[index];
    if (moved && item) void of.reading.write(opened.key, { chapter: item.path });
  }

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
      return path ? { path, name: page.name, spine } : null;
    },
    get left() {
      return before;
    },
    async open(next, place) {
      if (disposed) return;
      // A place left while the book was loading, or refused, has no chapter: it opens where it was kept.
      const asked = place?.path === next && 'spine' in place ? (place as EpubPlace).spine : -1;
      const at = asked >= 0 ? asked : null;
      if (next === path && epub) {
        if (at !== null && at !== spine) await draw(at, true);
        return;
      }
      if (path && path !== next) before = side.place;
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
      page.show(opened.title || epubTitleOf(baseName(next)), crumbsOf(next), opened.language);
      const kept = at === null ? (await of.reading.read(opened.key)).chapter : null;
      if (opening !== turn || disposed) return;
      const fromState = kept ? opened.spine.findIndex((item) => item.path === kept) : -1;
      const first = opened.contents[0]?.spine ?? 0;
      const valid = at !== null && at < opened.spine.length ? at : null;
      await draw(valid ?? (fromState >= 0 ? fromState : first), false);
    },
    go: (index) => draw(index, true),
    reload() {
      const place = side.place;
      epub = null;
      return place ? side.open(place.path, place) : Promise.resolve();
    },
    moved(to) {
      path = to;
      page.show(page.name, crumbsOf(to), epub?.language ?? '');
    },
    clear() {
      turn++;
      path = null;
      epub = null;
      spine = -1;
      letGo();
      page.nothing();
    },
    follow: (values) => page.wear(values),
    dispose() {
      disposed = true;
      letGo();
      page.dispose();
    },
  };
  return side;
}
