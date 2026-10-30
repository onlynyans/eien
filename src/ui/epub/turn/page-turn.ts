// A page turned (#40, Phase 3): the book moves on at once, and the motion
// the Page turn setting chooses runs between the page you left (a copy) and
// the one you're on. Asked for, so it moves: a key, a click, or a hand.
// Only Curl is held by the hand: one to one while held, then the hand's
// speed decides; a page in flight can be caught. Under Slide and Words a
// drag asks for the turn, as a key does. A key pressed mid-turn finishes the
// turn at once, so reading fast never waits on a motion; a key held down
// turns at once. Turn speed sets a key's turn and the finish; with reduced
// motion (the tokens at 0) the page changes at once and nothing is held.

import {
  beginCurl,
  type CurlTurn,
  curlTime,
  FIRST_STROKE,
  isInstant,
  keyCurl,
  nextStroke,
  type Point,
  type Stroke,
  turnScale,
  type Way,
} from '../../../core/epub';
import { CurlRun } from './curl-run';
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
  /**
   * The book a page `way` on, its new page on the sheet; false at the book's
   * end. At once within a chapter; into another, once that's drawn (a
   * promise), the motion waiting for it.
   */
  step(way: Way): boolean | Promise<boolean>;
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

/** A hand on the page: where it took hold, and the curl it holds once it's a drag. */
interface Hand {
  readonly at: Point;
  holding: CurlRun | null;
  /** It asked for a turn already: under Slide, Words or reduced motion the rest of the drag is nothing. */
  asked: boolean;
  /** Where it is now, and when: a curl still waiting for its page takes it from here. */
  offset: Point;
  time: number;
  /** Lifted while its curl was still waiting for its page. */
  lifted: boolean;
}

/** The book stepped on: the page left (copied), the one now on the sheet, and how it moves. */
interface Begun {
  readonly copy: HTMLElement;
  readonly sheet: HTMLElement;
  readonly tokens: TurnTokens;
  readonly scale: number;
  readonly style: TurnStyle;
}

const handAt = (at: Point, holding: CurlRun | null): Hand => ({
  at,
  holding,
  asked: holding !== null,
  offset: [0, 0],
  time: 0,
  lifted: false,
});

export class PageTurn {
  readonly #surface: TurnSurface;
  readonly #random: () => number;
  readonly #frames: Frames;
  readonly #tokens: (sheet: HTMLElement) => TurnTokens;
  #stroke: Stroke = FIRST_STROKE;
  #curl: CurlRun | null = null;
  /** Slide or Words running. */
  #steps: Stepping | null = null;
  #hand: Hand | null = null;
  /** Turns asked for while one waits for its page (a chapter being drawn). */
  #chain: Promise<void> | null = null;
  #disposed = false;

  constructor(surface: TurnSurface, of: PageTurnOf = {}) {
    this.#surface = surface;
    this.#random = of.random ?? Math.random;
    this.#frames = of.frames ?? nextFrame;
    this.#tokens = of.tokens ?? turnTokens;
    // A window put out of sight throttles its frames and timers: the turn lands now instead.
    document.addEventListener('visibilitychange', this.#hidden);
  }

  /** Whether a page is moving (or held) now. */
  get turning(): boolean {
    return this.#curl !== null || this.#steps !== null;
  }

  /**
   * A key's or a click's turn: a hand's stroke under Curl, the setting's
   * motion otherwise; `held` (a key held down, repeating), the page at once.
   */
  key(way: Way, held = false): void {
    this.#queued(() => this.#begin(way, (begun) => !held && this.#keyTurn(way, begun)));
  }

  /** A hand down on the page at `at` (its own pixels): a page in flight is caught there. */
  grab(at: Point): void {
    const curl = this.#curl;
    if (curl && curl.phase === 'flying') {
      curl.catch();
      this.#hand = handAt(at, curl);
      return;
    }
    this.#hand = handAt(at, null);
  }

  /** The hand `offset` from where it took hold, at `time`. */
  drag(offset: Point, time: number): void {
    const hand = this.#hand;
    if (!hand) return;
    hand.offset = offset;
    hand.time = time;
    if (hand.holding) {
      hand.holding.drag(offset, time);
      return;
    }
    if (hand.asked) return;
    const [dx, dy] = offset;
    if (Math.abs(dx) < DRAG_START || Math.abs(dx) < Math.abs(dy)) return;
    hand.asked = true;
    // Drawn leftward, the next page; rightward, the one before.
    const way: Way = dx < 0 ? 1 : -1;
    const sheet = this.#surface.sheet();
    if (this.#surface.how().style !== 'curl' || !sheet || isInstant(this.#tokens(sheet).calm)) {
      this.key(way);
      return;
    }
    this.#queued(() => this.#begin(way, (begun) => this.#hold(hand, way, begun)));
  }

  /** The hand lifted: its speed decides. Whether it was a drag (so not also a click). */
  letGo(): boolean {
    const hand = this.#hand;
    this.#hand = null;
    if (!hand) return false;
    hand.lifted = true;
    if (hand.holding) this.#throw(hand.holding);
    return hand.asked;
  }

  /** The turn in flight landed now, where it was going. */
  finish(): void {
    this.#curl?.finish();
    this.#steps?.finish();
  }

  dispose(): void {
    this.#disposed = true;
    this.#hand = null;
    document.removeEventListener('visibilitychange', this.#hidden);
    this.finish();
  }

  readonly #hidden = () => {
    if (document.hidden) this.finish();
  };

  /**
   * After the turns asked for before it (a chapter still being drawn), or now:
   * a key never waits on a motion, but it does wait its turn.
   */
  #queued(task: () => void | Promise<void>): void {
    const before = this.#chain;
    const ran = before ? before.then(task) : task();
    if (!ran) return;
    const chain: Promise<void> = ran
      .catch(() => {})
      .then(() => {
        if (this.#chain === chain) this.#chain = null;
      });
    this.#chain = chain;
  }

  /** The page before the turn copied and the book stepped on, then `then`; nothing at its end. */
  #begin(way: Way, then: (begun: Begun) => void): void | Promise<void> {
    this.finish();
    const before = this.#surface.sheet();
    if (!before || this.#disposed) return;
    const copy = pageCopy(before, this.#surface.words);
    const stepped = (moved: boolean) => {
      const sheet = this.#surface.sheet();
      if (!moved || !sheet || this.#disposed) return;
      const { style, speed } = this.#surface.how();
      then({ copy, sheet, tokens: this.#tokens(sheet), scale: turnScale(speed), style });
    };
    const moved = this.#surface.step(way);
    if (typeof moved === 'boolean') return stepped(moved);
    return moved.then(stepped);
  }

  /** A key's turn, the book stepped on: a hand's stroke under Curl, else the setting's motion. */
  #keyTurn(way: Way, { copy, sheet, tokens, scale, style }: Begun): void {
    if (style === 'curl') {
      this.#stroke = nextStroke(this.#stroke, this.#random);
      const time = curlTime(tokens.calm, scale, this.#stroke.pace);
      if (isInstant(time)) return;
      const page = { width: sheet.offsetWidth, height: sheet.offsetHeight };
      this.#curlOn(keyCurl(page, way, this.#stroke, time), copy, sheet, tokens).fly();
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

  /** A hand's curl, the book stepped on: held where the hand is now, or thrown if it's lifted already. */
  #hold(hand: Hand, way: Way, { copy, sheet, tokens }: Begun): void {
    const page = { width: sheet.offsetWidth, height: sheet.offsetHeight };
    const curl = this.#curlOn(beginCurl(page, way, hand.at[1]), copy, sheet, tokens);
    hand.holding = curl;
    curl.drag(hand.offset, hand.time);
    if (hand.lifted) this.#throw(curl);
  }

  /** Let go: the finish at the Turn speed, from the hand's own. */
  #throw(curl: CurlRun): void {
    if (curl.phase !== 'held') return;
    curl.fly(curlTime(curl.tokens.calm, turnScale(this.#surface.how().speed)));
  }

  #curlOn(turn: CurlTurn, copy: HTMLElement, sheet: HTMLElement, tokens: TurnTokens): CurlRun {
    const curl = new CurlRun(turn, {
      copy,
      sheet,
      words: this.#surface.words,
      tokens,
      frames: this.#frames,
      landed: (turnedOver) => {
        if (this.#curl === curl) this.#curl = null;
        if (!turnedOver) this.#surface.unstep();
      },
    });
    this.#curl = curl;
    return curl;
  }
}
