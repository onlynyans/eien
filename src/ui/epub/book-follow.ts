// Where a book's own links take the reader (#40, Phase 2b): a note's
// reference shows the note over the page (./note-over.ts), from this chapter
// or another (the last read for a note kept, as notes often live together in
// one file); any other link goes to its chapter and place, and the place it
// was followed from is kept, one step back (⌘[, Alt+←, or Back in the
// colophon). Choosing a chapter yourself forgets it.

import { chapterTitle, type Epub, isRefusal, type ZipAddress } from '../../core/epub';
import { drawClean } from '../draw-clean';
import { isNoteRef, noteIn } from './book-links';
import type { EpubPage } from './epub-page';
import type { EpubPlace } from './epub-side';
import { noteOver } from './note-over';

export interface BookFollowOf {
  readonly page: EpubPage;
  /** The book open, and the spine item on the page. */
  epub(): Epub | null;
  spine(): number;
  place(): EpubPlace | null;
  /**
   * The spine item `index` drawn, at the place `at` gives once it's drawn
   * (shown again when its pictures and fonts are in), kept as the place;
   * false when something else was asked for meanwhile.
   */
  draw(index: number, at: () => number): Promise<boolean>;
  /** Back at `place`, its chapter and line. */
  open(place: EpubPlace): Promise<void>;
  /** Keep the place now shown. */
  keep(offset: number): void;
}

export interface BookFollow {
  follow(anchor: HTMLAnchorElement, link: ZipAddress): Promise<void>;
  back(): Promise<void>;
  /** Another chapter chosen, or another book: no step back, no note open, nothing read for one kept. */
  forget(): void;
}

export function bookFollow(of: BookFollowOf): BookFollow {
  const { page } = of;
  let back: EpubPlace | null = null;
  let closeNote: (() => void) | null = null;
  let noteOpenFor: HTMLAnchorElement | null = null;
  /** The last other chapter read for its notes. */
  let read: {
    readonly epub: Epub;
    readonly index: number;
    readonly words: DocumentFragment;
  } | null = null;

  /** Counts what the reader asked for: a note or a place on its way is dropped once they've moved on. */
  let asked = 0;

  const shut = () => {
    closeNote?.();
    closed();
  };
  /** The note gone, however it closed (Esc, a click elsewhere, a scroll, Go to the note). */
  const closed = () => {
    closeNote = null;
    noteOpenFor = null;
  };

  /** The note the place `name` in the spine item `index` heads, drawn for the page over it. */
  async function noteWords(epub: Epub, index: number, name: string): Promise<Node | null> {
    if (index === of.spine()) return noteIn(page.chapter, name)?.cloneNode(true) ?? null;
    if (read?.epub !== epub || read.index !== index) {
      const chapter = await epub.chapter(index);
      if (isRefusal(chapter)) return null;
      // Its pictures as their words: a note's words are what's wanted here.
      read = { epub, index, words: drawClean(chapter.nodes) };
    }
    return noteIn(read.words, name)?.cloneNode(true) ?? null;
  }

  /** The place `name` in the spine item `index`, gone to, the place it was left at one step back. */
  async function goTo(index: number, name: string): Promise<void> {
    const mine = ++asked;
    const from = of.place();
    const at = () => (name ? (page.offsetOf(name) ?? 0) : 0);
    if (index !== of.spine()) {
      if (!(await of.draw(index, at)) || mine !== asked) return;
    } else {
      page.showPlace(at());
      of.keep(page.place);
    }
    const epub = of.epub();
    back = from;
    page.foot.backTo(
      from && epub ? (chapterTitle(epub.contents, from.spine) ?? 'the last place') : null,
    );
  }

  /** A link pressed, on the page or in a note over it. */
  async function follow(anchor: HTMLAnchorElement, link: ZipAddress): Promise<void> {
    const epub = of.epub();
    const index = epub?.spine.findIndex((item) => item.path === link.path) ?? -1;
    if (!epub || index < 0) return;
    // The reference pressed again: its note closes.
    if (noteOpenFor === anchor) return shut();
    const mine = ++asked;
    if (isNoteRef(anchor, link)) {
      const words = await noteWords(epub, index, link.fragment);
      if (mine !== asked || !anchor.isConnected) return;
      if (words) {
        shut();
        noteOpenFor = anchor;
        closeNote = noteOver({
          reference: anchor,
          words,
          face: page.element.dataset.face,
          scroller: page.scroller,
          go: () => void goTo(index, link.fragment),
          follow: (inNote, to) => void follow(inNote, to),
          closed,
        });
        return;
      }
    }
    shut();
    // A place this chapter doesn't have: nowhere to go.
    if (index === of.spine() && link.fragment && page.offsetOf(link.fragment) === null) return;
    await goTo(index, link.fragment);
  }

  return {
    follow,
    async back() {
      const to = back;
      if (!to) return;
      ++asked;
      back = null;
      page.foot.backTo(null);
      await of.open(to);
      of.keep(page.place);
    },
    forget() {
      ++asked;
      shut();
      back = null;
      read = null;
      page.foot.backTo(null);
    },
  };
}
