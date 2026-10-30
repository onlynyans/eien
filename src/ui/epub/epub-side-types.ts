// What a page holding an EPUB is (#40; ./epub-side.ts makes one), apart
// from how it's made: what the pages, the list and the shelf ask of it.

import type { Epub } from '../../core/epub';
import type { Place, Side } from '../vault/page-side';
import type { BookCounts } from './book-count';
import type { BookOpenOf } from './book-open';
import type { EpubPage } from './epub-page';
import type { ReadingStore } from './reading-store';

/** Where an EPUB's page was: the chapter it showed, by its place in the spine, and the line in it. */
export interface EpubPlace extends Place {
  readonly spine: number;
  /** An offset in the chapter's words (core/epub/place.ts): its first line in sight. */
  readonly offset: number;
}

export interface EpubSideOf extends BookOpenOf {
  readonly reading: ReadingStore;
  /** The window's counts of its books, for their page numbers (Phase 4). */
  readonly counts: BookCounts;
  /** Another book or chapter is on the page: the list and the shelf mark it. */
  changed(): void;
  /**
   * `quote` (Markdown) put in the note beside this page (Phase 2c): the
   * note's name; or why not, in words.
   */
  quote(
    quote: string,
    from: EpubSide,
  ): Promise<{ readonly into: string } | { readonly not: string }>;
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
  /** The page `offset` into spine item `spine` is on, as its label says it (Phase 4); null for none known. */
  labelAt(spine: number, offset: number): string | null;
  /** The words chosen in its chapter (or, `kept`, last chosen: a phone's ⋯) quoted in the note beside (Phase 2c), or why not, said. */
  quote(kept?: boolean): Promise<void>;
}

/** Whether `side` holds an EPUB: a page of this kind, not a test's stand-in of the same name. */
export const isEpub = (side: Side | null | undefined): side is EpubSide =>
  side?.kind === 'epub' && 'go' in side;
