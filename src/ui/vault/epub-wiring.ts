// The EPUB's parts wired to a shown vault (#40): its kind of page (with the
// reading state's store), what SHELF and the list show of the books on the
// pages, and what choosing a book or a chapter does. Made before the pages,
// which take its kind; the pages come in later.

import { isInside } from '../../core/paths';
import type { VaultBridge } from '../../platform/bridge';
import { type EpubKind, epubKind } from '../epub/epub-kind';
import { type EpubSide, isEpub } from '../epub/epub-side';
import { readingStore } from '../epub/reading-store';
import type { ContentsModel } from '../list/contents-list';
import type { ShelfActions, ShelfModel } from '../sidebar/shelf-rows';
import type { Navigation } from './navigation';
import type { Pages } from './pages';
import type { VaultState } from './vault-state';

export interface EpubWiringOf {
  readonly vault: VaultBridge;
  readonly state: Pick<VaultState, 'sizeOf'>;
  readonly nav: Navigation;
  tell(message: string): void;
  /** A book or a chapter on a page changed: the panes draw it. */
  redraw(): void;
  pages(): Pages;
  /** Open `path` on the active page, as a note is opened from a row (./note-actions.ts). */
  openHere(path: string): Promise<void>;
  /** The page in sight: on a phone, a chapter chosen in the contents shows it. */
  showPage(): void;
}

export interface EpubWiring {
  readonly kind: EpubKind;
  /** Choosing a book or a chapter; a book's menu and keys are a row's (./row-actions.ts). */
  readonly actions: Pick<ShelfActions, 'openEpub' | 'chapter'>;
  /** What SHELF marks: the book on the active page, and with `two` panes the open book's contents. */
  shelf(two: boolean): Omit<ShelfModel, 'tree'>;
  /** The contents the list shows in place of notes, or null. */
  contents(): (ContentsModel & { readonly side: EpubSide }) | null;
}

export function epubWiring(of: EpubWiringOf): EpubWiring {
  const pagesKind = epubKind({
    vault: of.vault,
    reading: readingStore(of.vault, of.tell),
    sizeOf: (path) => of.state.sizeOf(path),
    changed: () => of.redraw(),
  });
  const kind: EpubKind = {
    ...pagesKind,
    // A book moved or renamed (or a folder above it): its pages follow, and so do its contents in the list.
    moved(from, to) {
      pagesKind.moved(from, to);
      const shown = of.nav.contents;
      if (shown && isInside(shown, from)) of.nav.contents = to + shown.slice(from.length);
    },
  };
  /** The page showing the book at `path`, the active one first. */
  const sideOf = (path: string | null): EpubSide | null => {
    if (!path) return null;
    const pages = of.pages();
    return (
      [pages.active, ...pages.sides].find(
        (side): side is EpubSide => isEpub(side) && side.path === path,
      ) ?? null
    );
  };
  const contents = () => {
    const side = sideOf(of.nav.contents);
    const epub = side?.epub;
    if (!side || !epub) return null;
    return {
      side,
      title: side.page.name,
      author: epub.author,
      rows: epub.contents.map(({ title, depth, spine }) => ({ title, depth, spine })),
      spine: side.spine,
    };
  };
  return {
    kind,
    contents,
    shelf: (two) => {
      const active = of.pages().active;
      const shown = two ? contents() : null;
      return {
        current: isEpub(active) ? active.path : null,
        contents: shown && {
          path: shown.side.path as string,
          rows: shown.rows,
          spine: shown.spine,
        },
      };
    },
    actions: {
      openEpub: (path) => {
        of.nav.contents = path;
        void of.openHere(path);
      },
      chapter: (path, spine) => {
        const side = sideOf(path);
        if (!side) return;
        // The page that holds the book, not whichever is active: with a note beside it, the note stays.
        of.pages().activate(side);
        of.showPage();
        void side.go(spine);
      },
    },
  };
}
