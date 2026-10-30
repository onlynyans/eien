// A book turned page by page (#40, Phase 3b and 3c): the page turn
// (./turn/page-turn.ts) over a book's page. A turn goes a page on in the
// chapter, or past its end into the next chapter's first page (back, the
// last page of the one before), as the Page turn and Turn speed settings
// move it. A turn that falls back (a hand let go short) is put back where it
// began, and only a turn that lands is kept as the place.

import type { SettingValues } from '../../core/config';
import { chapterBeside, type Epub, type Way } from '../../core/epub';
import type { EpubPage } from './epub-page';
import { handEvents } from './turn/hand-events';
import { PageTurn } from './turn/page-turn';

export interface BookPagesOf {
  readonly page: EpubPage;
  epub(): Epub | null;
  /** The spine item drawn. */
  spine(): number;
  /** The spine item `index` drawn, at a place in its words or the one given once drawn; false if refused. */
  draw(index: number, place: number | (() => number)): Promise<boolean>;
  /** The shelf's settings now. */
  values(): SettingValues;
}

export interface BookPages {
  /** A page turned `way`: by a key (`held`, repeating), or the edges. */
  turn(way: Way, held: boolean): void;
  /** The chapter's first page or its last. */
  edge(last: boolean): void;
  /** The turn in flight landed now. */
  finish(): void;
  /** `run` once no turn shows a copy of a page (now, if none is turning). */
  whenStill(run: () => void): void;
  dispose(): void;
}

export function bookPages(of: BookPagesOf): BookPages {
  const { page } = of;
  /** Where the last step began, to go back to if its turn falls back. */
  let from: { readonly spine: number; readonly offset: number } | null = null;

  const turn = new PageTurn({
    sheet: () => page.leaf,
    words: '.epub-chapter',
    trim: (copy) => page.sheet.trim(copy),
    step(way) {
      // Only in pages, with a chapter drawn: a turn asked while a book opens (or after a switch to
      // Scroll) would draw a chapter over the one on its way, and keep it as the place.
      if (!page.sheet.paged || of.spine() < 0) return false;
      from = { spine: of.spine(), offset: page.sheet.place };
      if (page.sheet.turn(way)) return true;
      const epub = of.epub();
      const next = epub ? chapterBeside(epub.spine, of.spine(), way) : null;
      if (next === null) return false;
      // Into the next chapter at its start; back, at the last page of the one before.
      return of.draw(
        next,
        way > 0
          ? 0
          : () => {
              page.sheet.edge(true);
              return page.sheet.place;
            },
      );
    },
    unstep() {
      const was = from;
      if (!was) return;
      if (was.spine === of.spine()) page.sheet.showPlace(was.offset);
      // Back into the chapter it came from: the next turn waits for it to be drawn.
      else return of.draw(was.spine, was.offset).then(() => {});
    },
    how() {
      const values = of.values();
      return {
        style: values['epub.turn'],
        speed: Number(values['epub.turnSpeed']),
      };
    },
  });

  // A hand on the page (Phase 3c): a finger anywhere on it, a mouse at the book's edges.
  const stopHands = handEvents(turn, {
    target: page.scroller,
    sheet: () => page.leaf,
    paged: () => page.sheet.paged,
    edges: '.epub-edges__turn',
  });

  return {
    turn: (way, held) => turn.key(way, held),
    edge: (last) => {
      turn.finish();
      if (of.spine() >= 0) page.sheet.edge(last);
    },
    finish: () => turn.finish(),
    whenStill: (run) => turn.whenStill(run),
    dispose: () => {
      stopHands();
      turn.dispose();
    },
  };
}
