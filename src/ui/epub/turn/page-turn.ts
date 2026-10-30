// A page turned (#40, Phase 3): the book moves on at once, and the motion
// the Page turn setting chooses runs between the page you left (a copy) and
// the one you're on. Asked for, so it moves: a key, a click, or a hand.
// Only Curl is held by the hand: one to one while held, then the hand's
// speed decides; a page in flight can be caught, and a tap on it lets it fly
// on. Under Slide and Words a drag asks for the turn, as a key does. A key
// pressed mid-turn finishes the turn at once, so reading fast never waits on
// a motion; a key held down turns at once. Turn speed sets a key's turn and
// the finish; with reduced motion (the tokens at 0) the page changes at once
// and nothing is held. Nothing is copied unless something will move.
//
// The surface clips: the page you left goes out past the spine and the
// words come in from beyond the sheet, so the sheet's box must clip what
// lies outside it.

import {
  beginCurl,
  type CurlTurn,
  curlTime,
  FIRST_STROKE,
  isInstant,
  keyCurl,
  type Motion,
  motionTime,
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
import { acrossOf, type Hand, handAt, moved } from './turn-hand';
import { TurnQueue } from './turn-queue';
import { type TurnTokens, turnTokens } from './turn-tokens';

/** The Page turn setting's motions. */
export type TurnStyle = Motion;

export interface TurnSurface {
  /** The sheet in sight now: what turns. It clips what lies outside its box. */
  sheet(): HTMLElement | null;
  /** Where its words are, within a sheet or a copy of one: what Slide and Words move. */
  readonly words: string;
  /** A copy's words cut to what's in sight, so a turn moves a page and never a whole chapter. */
  trim?(words: HTMLElement): void;
  /**
   * The book a page `way` on, its new page on the sheet; false at the book's
   * end. At once within a chapter; into another, once that's drawn (a
   * promise), the motion waiting for it.
   */
  step(way: Way): boolean | Promise<boolean>;
  /** Back where the last step began (a hand's turn fallen back): at once, or once drawn. */
  unstep(): void | Promise<void>;
  /** The Page turn and Turn speed now. */
  how(): { readonly style: TurnStyle; readonly speed: number };
}

export interface PageTurnOf {
  readonly random?: () => number;
  readonly frames?: Frames;
  readonly tokens?: (sheet: HTMLElement) => TurnTokens;
}

/** How a turn is asked for: a key's, a key held down, or a hand's. */
type Asked = 'key' | 'held' | 'hand';

/** The book stepped on: the page left (copied, if anything will move), the one now on the sheet. */
interface Begun {
  readonly copy: HTMLElement | null;
  readonly sheet: HTMLElement;
  readonly tokens: TurnTokens;
  readonly scale: number;
  readonly style: TurnStyle;
}

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
  /** Turns waiting for the page they turn from. */
  readonly #queue = new TurnQueue();
  #disposed = false;

  constructor(surface: TurnSurface, of: PageTurnOf = {}) {
    this.#surface = surface;
    this.#random = of.random ?? Math.random;
    this.#frames = of.frames ?? nextFrame;
    this.#tokens = of.tokens ?? turnTokens;
    // A window put out of sight throttles its frames and timers: the turn is put down now instead.
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
    this.#queue.run(() =>
      this.#begin(way, held ? 'held' : 'key', (begun) => this.#keyTurn(way, begun)),
    );
  }

  /** A hand down on the page at `at` (its own pixels): a page in flight is caught there. */
  grab(at: Point): void {
    // A second hand (another finger, a lost pointer) never takes the page from the first.
    if (this.#hand?.holding?.phase === 'held') return;
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
    if (moved(offset)) hand.moved = true;
    if (hand.holding) {
      hand.holding.drag(offset, time);
      return;
    }
    if (hand.asked) return;
    const way = acrossOf(offset);
    if (way === null) return;
    hand.asked = true;
    const sheet = this.#surface.sheet();
    if (this.#surface.how().style !== 'curl' || !sheet || isInstant(this.#tokens(sheet).calm)) {
      this.key(way);
      return;
    }
    this.#queue.run(() => this.#begin(way, 'hand', (begun) => this.#hold(hand, way, begun)));
  }

  /**
   * The hand lifted: its speed decides. Whether it was a drag, not to be
   * taken for a click too (a tap on a page in flight lets it fly on, and is a
   * click: the next turn asks it to land).
   */
  letGo(): boolean {
    const hand = this.#hand;
    this.#hand = null;
    if (!hand) return false;
    hand.lifted = true;
    if (hand.caught && !hand.moved) {
      hand.holding?.resume();
      return false;
    }
    if (hand.holding) this.#throw(hand.holding);
    return hand.asked;
  }

  /** The turn in flight landed now, where it was going; one held turns on. */
  finish(): void {
    this.#curl?.finish();
    this.#steps?.finish();
  }

  dispose(): void {
    this.#disposed = true;
    this.#hand = null;
    document.removeEventListener('visibilitychange', this.#hidden);
    this.#putDown();
  }

  /** Put down unasked: in flight, landed; held, fallen back. */
  #putDown(): void {
    this.#curl?.drop();
    this.#steps?.finish();
  }

  readonly #hidden = () => {
    if (document.hidden) this.#putDown();
  };

  /** Whether a turn asked `asked` will move anything, under the setting now: if not, nothing is copied. */
  #moves(asked: Asked, style: TurnStyle, tokens: TurnTokens, scale: number): boolean {
    if (asked === 'held') return false;
    // A hand always moves the page it holds, at any Turn speed; under reduced motion it never holds.
    if (asked === 'hand') return true;
    return !isInstant(motionTime(style, tokens.calm, tokens.quick, scale));
  }

  /** The page before the turn copied (if it will move) and the book stepped on, then `then`. */
  #begin(way: Way, asked: Asked, then: (begun: Begun) => void): void | Promise<void> {
    this.finish();
    const back = this.#queue.drawingBack;
    if (back) return back.then(() => this.#begin(way, asked, then));
    const before = this.#surface.sheet();
    if (!before || this.#disposed) return;
    const { style, speed } = this.#surface.how();
    const scale = turnScale(speed);
    const moves = this.#moves(asked, style, this.#tokens(before), scale);
    const copy = moves
      ? pageCopy(before, this.#surface.words, (words) => this.#surface.trim?.(words))
      : null;
    const stepped = (moved: boolean) => {
      const sheet = this.#surface.sheet();
      if (!moved || !sheet || this.#disposed) return;
      then({ copy, sheet, tokens: this.#tokens(sheet), scale, style });
    };
    const moved = this.#surface.step(way);
    if (typeof moved === 'boolean') return stepped(moved);
    return moved.then(stepped);
  }

  /** A key's turn, the book stepped on: a hand's stroke under Curl, else the setting's motion. */
  #keyTurn(way: Way, { copy, sheet, tokens, scale, style }: Begun): void {
    if (!copy) return;
    if (style === 'curl') {
      this.#stroke = nextStroke(this.#stroke, this.#random);
      const time = curlTime(tokens.calm, scale, this.#stroke.pace);
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
    if (!copy) return;
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
      trim: (words) => this.#surface.trim?.(words),
      tokens,
      frames: this.#frames,
      landed: (turnedOver) => {
        if (this.#curl === curl) this.#curl = null;
        if (!turnedOver) this.#queue.fellBack(this.#surface.unstep());
      },
    });
    this.#curl = curl;
    return curl;
  }
}
