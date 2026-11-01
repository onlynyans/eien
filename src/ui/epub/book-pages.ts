// A book turned page by page (#40, Phase 3b and 3c): the page turn
// (./turn/page-turn.ts) over a book's page. A turn goes a page on in the
// chapter, or past its end into the next chapter's first page (back, the
// last page of the one before), as the Page turn and Turn speed settings
// move it. A turn that falls back (a hand let go short) is put back where it
// began, and only a turn that lands is kept as the place. In Scroll a finger
// swiped across turns the chapter (#71, ./chapter-swipe.ts), and a chapter
// turned there steps its words in as Words does, at the Turn speed.

import type { SettingValues } from '../../core/config';
import {
  chapterBeside,
  type Epub,
  isInstant,
  turnScale,
  type Way,
  wordsTime,
} from '../../core/epub';
import { chapterSwipe } from './chapter-swipe';
import type { EpubPage } from './epub-page';
import type { Spot } from './sight';
import { handEvents } from './turn/hand-events';
import { PageTurn } from './turn/page-turn';
import { turnTokens } from './turn/turn-tokens';
import { stepIn } from './turn/words';

export interface BookPagesOf {
  readonly page: EpubPage;
  epub(): Epub | null;
  /** The spine item drawn. */
  spine(): number;
  /** The spine item `index` drawn, at a place in its words or the one given once drawn; false if refused. */
  draw(index: number, place: number | (() => number)): Promise<boolean>;
  /** The shelf's settings now. */
  values(): SettingValues;
  /** The spine item `index` at its start, turned to by a hand, its place left a step back; whether it's drawn. */
  turnTo(index: number): Promise<boolean>;
}

export interface BookPages {
  /** A page turned `way`: by a key (`held`, repeating), or the edges. */
  turn(way: Way, held: boolean): void;
  /** The chapter's first page or its last. */
  edge(last: boolean): void;
  /** The turn in flight landed now. */
  finish(): void;
  /** In Scroll, the chapter just turned to `way` steps its words in. */
  stepIn(way: Way): void;
  /** `run` once no turn shows a copy of a page (now, if none is turning). */
  whenStill(run: () => void): void;
  dispose(): void;
}

export function bookPages(of: BookPagesOf): BookPages {
  const { page } = of;
  /** Where the last step began, to go back to if its turn falls back (a front page's too, Phase 3d). */
  let from: { readonly spine: number; readonly spot: Spot } | null = null;

  const turn = new PageTurn({
    sheet: () => page.leaf,
    words: '.epub-chapter',
    trim: (copy) => page.sheet.trim(copy),
    step(way) {
      // Only in pages, with a chapter drawn: a turn asked while a book opens (or after a switch to
      // Scroll) would draw a chapter over the one on its way, and keep it as the place.
      if (!page.sheet.paged || of.spine() < 0) return false;
      from = { spine: of.spine(), spot: page.sheet.spot };
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
      if (was.spine === of.spine()) page.sheet.restore(was.spot);
      // Back into the chapter it came from: the next turn waits for it to be drawn.
      else return of.draw(was.spine, was.spot.offset).then(() => {});
    },
    // On a spread one page turns round the gutter: on, the right; back, the left, in a mirror.
    leaf(way) {
      const gutter = page.sheet.gutter;
      if (gutter === null) return null;
      const width = page.leaf.offsetWidth;
      return way > 0
        ? { x: gutter, width: width - gutter, mirrored: false }
        : { x: 0, width: gutter, mirrored: true };
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

  /** A chapter's words stepping in (Scroll): put down by any draw, landed or not. */
  let stepping: Animation | null = null;
  const still = () => {
    stepping?.cancel();
    stepping = null;
  };
  const steps = (way: Way) => {
    still();
    const words = page.chapter;
    const tokens = turnTokens(words);
    const time = wordsTime(
      tokens.quick,
      tokens.calm,
      turnScale(Number(of.values()['epub.turnSpeed'])),
    );
    if (page.sheet.paged || isInstant(time.in)) return;
    const step = stepIn(words, way, tokens.step, time.in, tokens.ease);
    stepping = step;
    void step.finished.then(
      () => stepping === step && still(),
      () => {},
    );
  };
  const stopSwipes = chapterSwipe({
    target: page.scroller,
    sheet: () => page.leaf,
    paged: () => page.sheet.paged,
    async turn(way) {
      const epub = of.epub();
      const next = epub ? chapterBeside(epub.spine, of.spine(), way) : null;
      if (next !== null && (await of.turnTo(next))) steps(way);
    },
  });

  return {
    turn: (way, held) => turn.key(way, held),
    edge: (last) => {
      turn.finish();
      if (of.spine() >= 0) page.sheet.edge(last);
    },
    finish: () => {
      still();
      turn.finish();
    },
    stepIn: steps,
    whenStill: (run) => turn.whenStill(run),
    dispose: () => {
      stopHands();
      stopSwipes();
      still();
      turn.dispose();
    },
  };
}
