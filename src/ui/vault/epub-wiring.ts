// The EPUB's parts wired to a shown vault (#40): its kind of page (with the
// reading state's store), what SHELF and the list show of the books on the
// pages, what choosing a book or a chapter does, and which note a quote goes
// into (Phase 2c): the one on the page beside, or on a phone with one page,
// the note you came from, opened again. Made before the pages, which take
// its kind; the pages come in later.

import { withQuote } from '../../core/epub';
import { baseName, isInside } from '../../core/paths';
import { isNoteName } from '../../core/vault';
import type { VaultBridge } from '../../platform/bridge';
import { type EpubKind, epubKind } from '../epub/epub-kind';
import { type EpubSide, isEpub } from '../epub/epub-side';
import { readingStore } from '../epub/reading-store';
import type { ContentsModel } from '../list/contents-list';
import type { ShelfActions, ShelfModel } from '../sidebar/shelf-rows';
import type { Navigation } from './navigation';
import { isNote, type NoteSide } from './note-side';
import type { Pages } from './pages';
import type { VaultState } from './vault-state';

export interface EpubWiringOf {
  readonly vault: VaultBridge;
  readonly state: Pick<VaultState, 'sizeOf' | 'has'>;
  readonly nav: Navigation;
  tell(message: string): void;
  /** A book or a chapter on a page changed: the panes draw it. */
  redraw(): void;
  pages(): Pages;
  /**
   * Open `path` as a note chosen from a row is (./note-actions.ts, 'chosen'):
   * on the active page; with Wide screen's Two pages, facing the note open.
   */
  openChosen(path: string): Promise<void>;
  /** The page in sight: on a phone, a chapter chosen in the contents shows it. */
  showPage(): void;
  /** Whether the window goes the phone's way, a page at a time: a quote goes to the note you came from. */
  phone(): boolean;
}

export interface EpubWiring {
  readonly kind: EpubKind;
  /** Choosing a book or a chapter; a book's menu and keys are a row's (./row-actions.ts). */
  readonly actions: Pick<ShelfActions, 'openEpub' | 'chapter'>;
  /** Quote the words chosen on the active page, if it holds a book (the phone's ⋯). */
  quote(): void;
  /** What SHELF marks: the book on the active page, and with `two` panes the open book's contents. */
  shelf(two: boolean): Omit<ShelfModel, 'tree'>;
  /** The contents the list shows in place of notes, or null. */
  contents(): (ContentsModel & { readonly side: EpubSide }) | null;
}

/** Why a quote has nowhere to go. */
const NO_NOTE = 'Open a note beside the book to quote into it.';

export function epubWiring(of: EpubWiringOf): EpubWiring {
  /** The note `from`'s quote goes into: the page beside it, else on a phone the one it was opened from. */
  const noteFor = async (from: EpubSide): Promise<NoteSide | null> => {
    const pages = of.pages();
    const beside = pages.sides.find(
      (side): side is NoteSide => side !== from && isNote(side) && side.path !== null,
    );
    if (beside || !of.phone()) return beside ?? null;
    const left = from.left;
    if (!left || !isNoteName(baseName(left.path)) || !of.state.has(left.path)) return null;
    // A page at a time: the note comes back where it was, the book a tap away (⇄).
    await pages.open(left.path, false, left);
    const now = pages.active;
    return isNote(now) && now.path === left.path ? now : null;
  };
  const pagesKind = epubKind({
    vault: of.vault,
    reading: readingStore(of.vault, of.tell),
    sizeOf: (path) => of.state.sizeOf(path),
    changed: () => of.redraw(),
    async quote(text, from) {
      const note = await noteFor(from);
      if (!note) return { not: NO_NOTE };
      const name = note.page.name;
      // Held still a moment (moving, or still opening): nothing changed, and it says so.
      const done = note.page.editor.addAtEnd((words) => withQuote(words, text))
        ? { into: name }
        : { not: `${name} can’t take a quote just now: try again in a moment.` };
      // The book gave its page to the note (a phone's one page): the note's colophon says it.
      if (!of.pages().sides.includes(from))
        note.page.foot.tell('into' in done ? `Quoted in ${done.into}.` : done.not);
      return done;
    },
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
    quote: () => {
      const active = of.pages().active;
      // The phone's ⋯: the words last chosen, which its tap may have dropped.
      if (isEpub(active)) void active.quote(true);
    },
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
        void of.openChosen(path);
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
