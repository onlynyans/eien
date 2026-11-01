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
  type TurnAsked as Asked,
  beginCurl,
  type CurlTurn,
  curlTime,
  FIRST_STROKE,
  isInstant,
  keyCurl,
  nextStroke,
  type Point,
  type Stroke,
  turnMoves,
  turnScale,
  type Way,
} from '../../../core/epub';
import { CurlRun } from './curl-run';
import { type Frames, nextFrame } from './next-frame';
import { pageCopy } from './page-copy';
import { type Stepping, stepTurn } from './step-turn';
import { acrossOf, type Hand, handAt, moved } from './turn-hand';
import { TurnQueue } from './turn-queue';
import type { PageTurnOf, TurnLeaf, TurnStyle, TurnSurface } from './turn-surface';
import { type TurnTokens, turnTokens } from './turn-tokens';

/** The book stepped on: the page left (copied, if anything will move), the one now on the sheet. */
interface Begun {
  readonly copy: HTMLElement | null;
  readonly sheet: HTMLElement;
  /** One page of two that turns (a spread), measured before the step; null, the whole sheet. */
  readonly leaf: TurnLeaf | null;
  readonly tokens: TurnTokens;
  readonly scale: number;
  readonly style: TurnStyle;
}

/**
 * The box a curl turns: the leaf's, one page of a spread (a curl on it always
 * turns on, a back turn's mirrored), or the whole sheet.
 */
const pageOf = (sheet: HTMLElement, leaf: TurnLeaf | null) => ({
  width: leaf ? leaf.width : sheet.offsetWidth,
  height: sheet.offsetHeight,
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
  /** Turns waiting for the page they turn from. */
  readonly #queue = new TurnQueue();
  #disposed = false;
  /** A turn's copy made, its page being stepped to. */
  #begun = false;

  constructor(surface: TurnSurface, of: PageTurnOf = {}) {
    this.#surface = surface;
    this.#random = of.random ?? Math.random;
    this.#frames = of.frames ?? nextFrame;
    this.#tokens = of.tokens ?? turnTokens;
    // A window put out of sight throttles its frames and timers: the turn is put down now instead.
    document.addEventListener('visibilitychange', this.#hidden);
  }

  /** Whether a page is moving (or held) now, or a turn's copy is made and waits for its page. */
  get turning(): boolean {
    return this.#curl !== null || this.#steps !== null || this.#begun;
  }

  /** Whether a curl is in flight now: what a hand may catch. */
  get catchable(): boolean {
    return this.#curl?.phase === 'flying';
  }

  /** `run` once no turn shows a copy of a page: now, if none is turning (a chapter's pictures let go). */
  whenStill(run: () => void): void {
    this.#queue.whenStill(this.turning, run);
  }

  #settled(): void {
    if (!this.turning) this.#queue.still();
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
    hand.lifted = 'up';
    if (hand.caught && !hand.moved) {
      hand.holding?.resume();
      return false;
    }
    if (hand.holding) this.#throw(hand.holding);
    return hand.asked;
  }

  /**
   * The hand gone unasked (its gesture cancelled: a pinch began, the system
   * took it): a page it held falls back, never thrown. Whether it was a drag.
   */
  cancel(): boolean {
    const hand = this.#hand;
    this.#hand = null;
    if (!hand) return false;
    hand.lifted = 'cancelled';
    if (hand.holding) this.#home(hand.holding);
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
    this.#begun = false;
    this.#settled();
  }

  /** Put down unasked: in flight, landed; held, fallen back. */
  #putDown(): void {
    this.#curl?.drop();
    this.#steps?.finish();
  }

  readonly #hidden = () => {
    if (document.hidden) this.#putDown();
  };

  /** The page before the turn copied (if it will move) and the book stepped on, then `then`. */
  #begin(way: Way, asked: Asked, then: (begun: Begun) => void): void | Promise<void> {
    this.finish();
    const back = this.#queue.drawingBack;
    if (back) return back.then(() => this.#begin(way, asked, then));
    const before = this.#surface.sheet();
    if (!before || this.#disposed) return;
    const { style, speed } = this.#surface.how();
    const scale = turnScale(speed);
    const tokens = this.#tokens(before);
    const moves = turnMoves(asked, style, tokens.calm, tokens.quick, scale);
    const copy = moves ? this.#copy(before) : null;
    const leaf = moves && style === 'curl' ? (this.#surface.leaf?.(way) ?? null) : null;
    this.#begun = true;
    const stepped = (moved: boolean) => {
      this.#begun = false;
      const sheet = this.#surface.sheet();
      if (moved && sheet && !this.#disposed) {
        then({ copy, sheet, leaf, tokens: this.#tokens(sheet), scale, style });
      }
      this.#settled();
    };
    const moved = this.#surface.step(way);
    if (typeof moved === 'boolean') return stepped(moved);
    return moved.then(stepped);
  }

  /** A key's turn, the book stepped on: a hand's stroke under Curl, else the setting's motion. */
  #keyTurn(way: Way, { copy, sheet, leaf, tokens, scale, style }: Begun): void {
    if (!copy) return;
    if (style === 'curl') {
      this.#stroke = nextStroke(this.#stroke, this.#random);
      const time = curlTime(tokens.calm, scale, this.#stroke.pace);
      const turn = keyCurl(pageOf(sheet, leaf), leaf ? 1 : way, this.#stroke, time);
      this.#curlOn(turn, copy, sheet, leaf, tokens)?.fly();
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
        this.#settled();
      },
    });
    this.#steps = steps;
  }

  /** A hand's curl, the book stepped on: held where the hand is now, or thrown if it's lifted already. */
  #hold(hand: Hand, way: Way, { copy, sheet, leaf, tokens }: Begun): void {
    if (!copy) return;
    const turn = beginCurl(pageOf(sheet, leaf), leaf ? 1 : way, hand.at[1]);
    const curl = this.#curlOn(turn, copy, sheet, leaf, tokens);
    // No copy of the page come to: it's there already, turned at once.
    if (!curl) return;
    hand.holding = curl;
    curl.drag(hand.offset, hand.time);
    // Gone before its page came: thrown if let go, home if the gesture was cancelled.
    if (hand.lifted === 'up') this.#throw(curl);
    else if (hand.lifted === 'cancelled') this.#home(curl);
  }

  /** A cancelled gesture's page: home over the turn's time, as a hand let go short, never snatched away. */
  #home(curl: CurlRun): void {
    if (curl.phase !== 'held') return;
    curl.fallBack(curlTime(curl.tokens.calm, turnScale(this.#surface.how().speed)));
  }

  /** Let go: the finish at the Turn speed, from the hand's own. */
  #throw(curl: CurlRun): void {
    if (curl.phase !== 'held') return;
    curl.fly(curlTime(curl.tokens.calm, turnScale(this.#surface.how().speed)));
  }

  /** A copy of `sheet` as it is now, kept to the words round the sight; null for none to be had. */
  #copy(sheet: HTMLElement): HTMLElement | null {
    return pageCopy(sheet, this.#surface.words, (words) => this.#surface.trim?.(words) ?? true);
  }

  /**
   * The curl over `sheet`, from `copy` of the page left and a copy of the
   * page come to: curling back over it (a whole sheet turned back), or on the
   * turning page's back (a spread). Null where a whole sheet turned back has
   * none; a spread without one shows its own words on its back.
   */
  #curlOn(
    turn: CurlTurn,
    copy: HTMLElement,
    sheet: HTMLElement,
    leaf: TurnLeaf | null,
    tokens: TurnTokens,
  ): CurlRun | null {
    const whole = turn.way < 0 && !leaf;
    const coming = whole || leaf ? this.#copy(sheet) : null;
    if (whole && !coming) return null;
    const curl = new CurlRun(turn, {
      copy,
      sheet,
      leaf,
      coming,
      tokens,
      frames: this.#frames,
      landed: (turnedOver) => {
        if (this.#curl === curl) this.#curl = null;
        this.#settled();
        if (!turnedOver) this.#queue.fellBack(this.#surface.unstep());
      },
    });
    this.#curl = curl;
    return curl;
  }
}
