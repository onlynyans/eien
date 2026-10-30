// A page turned (#40, Phase 3): the book moves on at once, and the motion
// the Page turn setting chooses runs between the page you left (a copy) and
// the one you're on. Asked for, so it moves: a key, a click, or a hand.
// Only Curl is held by the hand: one to one while held, then the hand's
// speed decides; a page in flight can be caught. Under Slide and Words a
// drag asks for the turn, as a key does. A key pressed mid-turn finishes the
// turn at once, so reading fast never waits on a motion. Turn speed sets a
// key's turn and the finish; with reduced motion (the tokens at 0) the page
// changes at once and nothing is held. The states are core's (curl-turn.ts).

import {
  beginCurl,
  type CurlTurn,
  catchCurl,
  curlFrame,
  curlTime,
  dragCurl,
  FIRST_STROKE,
  finishCurl,
  isInstant,
  keyCurl,
  letGoCurl,
  nextStroke,
  type Point,
  type Stroke,
  tickCurl,
  turned,
  turnScale,
  type Way,
} from '../../../core/epub';
import { CurlView } from './curl-view';
import { type Frames, nextFrame } from './next-frame';
import { pageCopy } from './page-copy';
import { type Stepping, stepTurn } from './step-turn';
import { type TurnTokens, turnTokens } from './turn-tokens';

export type TurnStyle = 'curl' | 'slide' | 'words';

/** A hand's way before it's a drag: this far across, in pixels, and more across than down. */
export const DRAG_START = 6;

export interface TurnSurface {
  /** The sheet in sight now: what turns. */
  sheet(): HTMLElement | null;
  /** Where its words are, within a sheet or a copy of one: what Slide and Words move. */
  readonly words: string;
  /** The book a page `way` on, at once, its new page on the sheet; false at the book's end. */
  step(way: Way): boolean;
  /** Back where the last step began: a hand's turn fallen back. */
  unstep(): void;
  /** The Page turn and Turn speed now. */
  how(): { readonly style: TurnStyle; readonly speed: number };
}

export interface PageTurnOf {
  readonly random?: () => number;
  readonly frames?: Frames;
  readonly tokens?: (sheet: HTMLElement) => TurnTokens;
}

/** A curl on the page: its state and its drawing. */
interface Curling {
  turn: CurlTurn;
  readonly view: CurlView;
  readonly tokens: TurnTokens;
  stop: () => void;
}

/** A hand on the page: where it took hold, and the curl it holds once it's a drag. */
interface Hand {
  readonly at: Point;
  holding: Curling | null;
  /** It asked for a turn already (Slide, Words, reduced motion): the rest of the drag is nothing. */
  asked: boolean;
}

export class PageTurn {
  readonly #surface: TurnSurface;
  readonly #random: () => number;
  readonly #frames: Frames;
  readonly #tokens: (sheet: HTMLElement) => TurnTokens;
  #stroke: Stroke = FIRST_STROKE;
  #curl: Curling | null = null;
  /** Slide or Words running. */
  #steps: Stepping | null = null;
  #hand: Hand | null = null;
  #drawing = false;

  constructor(surface: TurnSurface, of: PageTurnOf = {}) {
    this.#surface = surface;
    this.#random = of.random ?? Math.random;
    this.#frames = of.frames ?? nextFrame;
    this.#tokens = of.tokens ?? turnTokens;
  }

  /** Whether a page is moving (or held) now. */
  get turning(): boolean {
    return this.#curl !== null || this.#steps !== null;
  }

  /** A key's or a click's turn: a hand's stroke under Curl, the setting's motion otherwise. */
  key(way: Way): void {
    const begun = this.#begin(way);
    if (!begun) return;
    const { copy, sheet, tokens, scale, style } = begun;
    if (style === 'curl') {
      this.#stroke = nextStroke(this.#stroke, this.#random);
      const time = curlTime(tokens.calm, scale, this.#stroke.pace);
      if (isInstant(time)) return;
      const page = { width: sheet.offsetWidth, height: sheet.offsetHeight };
      this.#fly(this.#curlOn(keyCurl(page, way, this.#stroke, time), copy, sheet, tokens));
      return;
    }
    const steps = stepTurn({
      style,
      way,
      copy,
      sheet,
      words: this.#surface.words,
      tokens,
      scale,
      ended: () => {
        if (this.#steps === steps) this.#steps = null;
      },
    });
    this.#steps = steps;
  }

  /** A hand down on the page at `at` (its own pixels): a page in flight is caught there. */
  grab(at: Point): void {
    const curl = this.#curl;
    if (curl && curl.turn.phase === 'flying') {
      curl.stop();
      curl.turn = catchCurl(curl.turn);
      this.#hand = { at, holding: curl, asked: true };
      return;
    }
    this.#hand = { at, holding: null, asked: false };
  }

  /** The hand `offset` from where it took hold, at `time`. */
  drag(offset: Point, time: number): void {
    const hand = this.#hand;
    if (!hand) return;
    if (hand.holding) {
      hand.holding.turn = dragCurl(hand.holding.turn, offset, time);
      this.#drawSoon();
      return;
    }
    if (hand.asked) return;
    const [dx, dy] = offset;
    if (Math.abs(dx) < DRAG_START || Math.abs(dx) < Math.abs(dy)) return;
    hand.asked = true;
    // Drawn leftward, the next page; rightward, the one before.
    const way: Way = dx < 0 ? 1 : -1;
    const { style } = this.#surface.how();
    const sheet = this.#surface.sheet();
    if (style !== 'curl' || !sheet || isInstant(this.#tokens(sheet).calm)) {
      this.key(way);
      return;
    }
    const begun = this.#begin(way);
    if (!begun) return;
    const page = { width: begun.sheet.offsetWidth, height: begun.sheet.offsetHeight };
    const curl = this.#curlOn(
      beginCurl(page, way, hand.at[1]),
      begun.copy,
      begun.sheet,
      begun.tokens,
    );
    curl.turn = dragCurl(curl.turn, offset, time);
    hand.holding = curl;
    curl.view.draw(this.#frameOf(curl));
  }

  /** The hand lifted: its speed decides. Whether it was a drag (so not also a click). */
  letGo(): boolean {
    const hand = this.#hand;
    this.#hand = null;
    if (!hand) return false;
    const curl = hand.holding;
    if (curl && curl.turn.phase === 'held') {
      const time = curlTime(curl.tokens.calm, turnScale(this.#surface.how().speed));
      curl.turn = letGoCurl(curl.turn, time);
      this.#fly(curl);
    }
    return hand.asked;
  }

  /** The turn in flight landed now, where it was going. */
  finish(): void {
    const curl = this.#curl;
    if (curl) {
      curl.turn = finishCurl(curl.turn);
      this.#land(curl);
    }
    this.#steps?.finish();
  }

  dispose(): void {
    this.#hand = null;
    this.finish();
  }

  /** The page before the turn copied, the book stepped on; null at its end. */
  #begin(way: Way) {
    this.finish();
    const before = this.#surface.sheet();
    if (!before) return null;
    const copy = pageCopy(before, this.#surface.words);
    if (!this.#surface.step(way)) return null;
    const sheet = this.#surface.sheet();
    if (!sheet) return null;
    const { style, speed } = this.#surface.how();
    return { copy, sheet, tokens: this.#tokens(sheet), scale: turnScale(speed), style };
  }

  #curlOn(turn: CurlTurn, copy: HTMLElement, sheet: HTMLElement, tokens: TurnTokens): Curling {
    const curl: Curling = {
      turn,
      view: new CurlView(copy, sheet, turn.way, this.#surface.words),
      tokens,
      stop: () => {},
    };
    this.#curl = curl;
    return curl;
  }

  #frameOf(curl: Curling) {
    const { page, rest, moving } = curl.turn;
    return curlFrame(page, rest, moving.at, curl.tokens);
  }

  /** Flying: a frame at a time till it lands. */
  #fly(curl: Curling): void {
    curl.view.draw(this.#frameOf(curl));
    let last: number | null = null;
    const tick = (now: number) => {
      curl.turn = tickCurl(curl.turn, last === null ? 0 : now - last);
      last = now;
      if (curl.turn.phase === 'landed') {
        this.#land(curl);
        return;
      }
      curl.view.draw(this.#frameOf(curl));
      curl.stop = this.#frames(tick);
    };
    curl.stop = this.#frames(tick);
  }

  /** Landed: the curl gone, and if it fell back the book where it was. */
  #land(curl: Curling): void {
    curl.stop();
    curl.view.remove();
    if (this.#curl === curl) this.#curl = null;
    if (!turned(curl.turn)) this.#surface.unstep();
  }

  /** While held, the page drawn once a frame however often the hand moves. */
  #drawSoon(): void {
    if (this.#drawing) return;
    this.#drawing = true;
    this.#frames(() => {
      this.#drawing = false;
      const curl = this.#curl;
      if (curl) curl.view.draw(this.#frameOf(curl));
    });
  }
}
