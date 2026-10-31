// The EPUB's parts wired to a shown vault (#40): its kind of page (with the
// reading state's store), what SHELF and the list show of the books on the
// pages, what choosing a book or a chapter does, and which note a quote goes
// into (Phase 2c): the one on the page beside, or on a phone with one page,
// the note you came from, opened again. Made before the pages, which take
// its kind; the pages come in later.

import { chapterTitle, type Epub, withQuote } from '../../core/epub';
import { baseName, isInside } from '../../core/paths';
import { isNoteName } from '../../core/vault';
import type { VaultBridge } from '../../platform/bridge';
import { BookCounts } from '../epub/book-count';
import { type EpubKind, epubKind } from '../epub/epub-kind';
import { type EpubSide, isEpub } from '../epub/epub-side-types';
import { readingStore } from '../epub/reading-store';
import type { MarkRow } from '../list/book-lenses';
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
  /** How a book's commands look changed (its page bookmarked or not): the controls show it. */
  looks(): void;
  /** Where a book's marks are (the Marks setting, Phase 4d): in the list, or on the page's edge. */
  marksAt(): 'list' | 'edge';
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
  readonly actions: Pick<ShelfActions, 'openEpub' | 'chapter' | 'lens' | 'goMark' | 'unmark'>;
  /** What SHELF marks: the book on the active page, and with `two` panes the open book's contents. */
  shelf(two: boolean): Omit<ShelfModel, 'tree' | 'shut'>;
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
    counts: new BookCounts(),
    looks: () => of.looks(),
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
  /**
   * The page holding the book at `path` made the active one and in sight, for
   * a row chosen under it: not whichever is active, so with a note beside it
   * the note stays.
   */
  const toBook = (path: string): EpubSide | null => {
    const side = sideOf(path);
    if (!side) return null;
    of.pages().activate(side);
    of.showPage();
    return side;
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
  /** The book's marks, bookmarks and highlights, as their rows show them, in its order (Phase 4c, 5b). */
  const marksOf = (side: EpubSide, epub: Epub): MarkRow[] =>
    side.marks.inOrder(epub).map((mark) => ({
      ...mark,
      page: side.labelAt(mark.spine, mark.offset),
      chapter: chapterTitle(epub.contents, mark.spine) ?? side.page.name,
    }));
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
      // On the edge, the list is the contents alone: no lenses.
      lens: of.nav.bookLens,
      marks: of.marksAt() === 'list' ? marksOf(side, epub) : null,
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
          lens: shown.lens,
          marks: shown.marks,
        },
      };
    },
    actions: {
      openEpub: (path) => {
        // Another book's rows begin at its contents.
        if (of.nav.contents !== path) of.nav.bookLens = 'contents';
        of.nav.contents = path;
        void of.openChosen(path);
      },
      chapter: (path, spine) => {
        const side = toBook(path);
        if (side) void side.go(spine);
      },
      lens: (_path, lens) => {
        of.nav.bookLens = lens;
        of.redraw();
      },
      goMark: (path, row) => void toBook(path)?.goTo(row.spine, row.offset),
      unmark: (path, row) => {
        const marks = sideOf(path)?.marks;
        if (row.kind === 'bookmark') void marks?.bookmarks.remove(row.mark);
        else void marks?.highlights.remove(row.mark);
      },
    },
  };
}
