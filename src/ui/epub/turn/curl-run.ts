// One curl on the page (#40, Phase 3), from its first frame to landing:
// core's states (curl-turn.ts) drawn by ./curl-view.ts. Held, it's drawn
// once a frame however often the hand moves; flying, a frame at a time until
// it lands; landed, it's gone, and the page turn is told whether it turned.

import {
  type CurlTurn,
  catchCurl,
  curlFrame,
  dragCurl,
  dropCurl,
  finishCurl,
  letGoCurl,
  type Point,
  resumeCurl,
  tickCurl,
  turned,
} from '../../../core/epub';
import { CurlView } from './curl-view';
import type { Frames } from './next-frame';
import type { TurnTokens } from './turn-tokens';

export interface CurlRunOf {
  readonly copy: HTMLElement;
  readonly sheet: HTMLElement;
  readonly words: string;
  readonly tokens: TurnTokens;
  readonly frames: Frames;
  /** Landed: turned, or fallen back. */
  landed(turnedOver: boolean): void;
}

export class CurlRun {
  #turn: CurlTurn;
  readonly #view: CurlView;
  readonly #of: CurlRunOf;
  #stop: () => void = () => {};
  #drawing = false;
  #over = false;

  constructor(turn: CurlTurn, of: CurlRunOf) {
    this.#turn = turn;
    this.#of = of;
    this.#view = new CurlView(of.copy, of.sheet, turn.way, of.words);
    this.#draw();
  }

  get phase(): CurlTurn['phase'] {
    return this.#turn.phase;
  }

  /** The tokens it was begun with: a hand's finish is timed by them. */
  get tokens(): TurnTokens {
    return this.#of.tokens;
  }

  /** Held: the hand `offset` from where it took the corner, at `time`. */
  drag(offset: Point, time: number): void {
    if (this.#over) return;
    this.#turn = dragCurl(this.#turn, offset, time);
    if (this.#drawing) return;
    this.#drawing = true;
    this.#stop = this.#of.frames(() => {
      this.#drawing = false;
      this.#draw();
    });
  }

  /** Let go, the finish landing in `time`; or, a key's, flying from the first. */
  fly(time?: number): void {
    if (time !== undefined) this.#turn = letGoCurl(this.#turn, time);
    this.#flyOn();
  }

  /** Caught, and let go without a drag: on to where it was going. */
  resume(): void {
    this.#turn = resumeCurl(this.#turn);
    this.#flyOn();
  }

  #flyOn(): void {
    if (this.#turn.phase !== 'flying') return;
    this.#stop();
    this.#drawing = false;
    let last: number | null = null;
    const tick = (now: number) => {
      this.#turn = tickCurl(this.#turn, last === null ? 0 : now - last);
      last = now;
      if (this.#turn.phase === 'landed') {
        this.#land();
        return;
      }
      this.#draw();
      this.#stop = this.#of.frames(tick);
    };
    this.#stop = this.#of.frames(tick);
  }

  /** Caught in flight: held where it is. */
  catch(): void {
    this.#stop();
    this.#turn = catchCurl(this.#turn);
  }

  /** Landed now, where it was going; held, turned (a key asked for the next page). */
  finish(): void {
    this.#turn = finishCurl(this.#turn);
    this.#land();
  }

  /** Put down now, unasked: in flight it lands, held it falls back. */
  drop(): void {
    this.#turn = dropCurl(this.#turn);
    this.#land();
  }

  #draw(): void {
    const { page, rest, moving } = this.#turn;
    this.#view.draw(curlFrame(page, rest, moving.at, this.#of.tokens));
  }

  #land(): void {
    if (this.#over) return;
    this.#over = true;
    this.#stop();
    this.#view.remove();
    this.#of.landed(turned(this.#turn));
  }
}
