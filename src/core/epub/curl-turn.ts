// A curl's turn through its states (#40, Phase 3): begun by a hand (held)
// or a key (flying at once); held, the corner one to one with the hand; let
// go, the hand's speed decides whether it turns or falls back; flying, the
// spring carries it there; caught in flight, it's held again where it is;
// finished at once, it lands. Each state a value and each step a function,
// so the window only draws them.

import type { PageBox, Point } from './turn-curl';
import { heldAt } from './turn-curl';
import { type Moving, omegaFor, springStep } from './turn-spring';
import { arcHeight, type Stroke } from './turn-stroke';

/** The hand's speed is read from its last this-many milliseconds. */
export const THROW_MS = 80;
/** Where the throw would carry the corner, this many milliseconds on, decides it. */
const THROW_AHEAD_MS = 180;
/** Past this much of the page from the spine, it turns; short of it, it falls back. */
const TURN_PAST = 1 / 4;
/** Back, the page comes from beyond the spine, so the corner goes twice the hand's way. */
const BACK_REACH = 2;

export type Way = 1 | -1;
export type CurlPhase = 'held' | 'flying' | 'landed';

interface Sample {
  readonly time: number;
  readonly at: Point;
}

export interface CurlTurn {
  readonly page: PageBox;
  /** 1 to the next page, -1 to the one before. */
  readonly way: Way;
  /** Where the corner rests: the page's outer edge, at the height it was taken. */
  readonly rest: Point;
  /** Where it starts: at rest going on; turned over beyond the spine coming back. */
  readonly from: Point;
  /** Where it lands once turned. */
  readonly done: Point;
  readonly moving: Moving;
  readonly phase: CurlPhase;
  /** Where it's flying to, or landed on; none while held. */
  readonly target: Point | null;
  /** How long the finish takes to land, in milliseconds: 0 is at once. */
  readonly time: number;
  /** A key's turn rides an arc: its stroke and the height it was taken at. */
  readonly arc: Stroke | null;
  /** While held: where the corner was as the hand took it, and the hand's last places. */
  readonly grab: Point;
  readonly samples: readonly Sample[];
}

/** A turn `way` begun, the corner taken `taken` down the page's outer edge, held. */
export function beginCurl(page: PageBox, way: Way, taken: number): CurlTurn {
  const y = Math.min(page.height, Math.max(0, taken));
  const rest: Point = [page.width, y];
  const beyond: Point = [-page.width, y];
  const from = way > 0 ? rest : beyond;
  return {
    page,
    way,
    rest,
    from,
    done: way > 0 ? beyond : rest,
    moving: { at: from, speed: [0, 0] },
    phase: 'held',
    target: null,
    time: 0,
    arc: null,
    grab: from,
    samples: [],
  };
}

/** A key's turn: a hand's, taken where `stroke` says, flying at once on its arc, landing in `time`. */
export function keyCurl(page: PageBox, way: Way, stroke: Stroke, time: number): CurlTurn {
  const turn = beginCurl(page, way, stroke.grip * page.height);
  const speed = time > 0 ? (-way * page.width) / time : 0;
  return {
    ...turn,
    phase: 'flying',
    target: turn.done,
    time,
    arc: stroke,
    moving: { at: turn.from, speed: [speed, 0] },
  };
}

/** Held, the hand `offset` from where it took the corner at `time`: the corner there, as far as the spine lets it. */
export function dragCurl(turn: CurlTurn, offset: Point, time: number): CurlTurn {
  if (turn.phase !== 'held') return turn;
  const reach = turn.way > 0 ? 1 : BACK_REACH;
  const hand: Point = [turn.grab[0] + offset[0] * reach, turn.grab[1] + offset[1]];
  const at = heldAt(turn.page, turn.rest, hand);
  const samples = [...turn.samples, { time, at }];
  while (samples.length > 2 && time - (samples[0] as Sample).time > THROW_MS) samples.shift();
  return { ...turn, moving: { at, speed: [0, 0] }, samples };
}

/** Whether a corner at `at`, thrown at `speed`, would turn the page. */
export function turns(turn: CurlTurn, at: Point, speed: Point): boolean {
  const thrown = at[0] + speed[0] * THROW_AHEAD_MS;
  const past = turn.page.width * TURN_PAST;
  return turn.way > 0 ? thrown < past : thrown > -past;
}

/** Let go: from the hand's own speed, flying on to turn or back to where it began, landing in `time`. */
export function letGoCurl(turn: CurlTurn, time: number): CurlTurn {
  if (turn.phase !== 'held') return turn;
  const first = turn.samples[0];
  const last = turn.samples.at(-1);
  const span = Math.max(1, (last?.time ?? 0) - (first?.time ?? 0));
  const speed: Point =
    first && last && last !== first
      ? [(last.at[0] - first.at[0]) / span, (last.at[1] - first.at[1]) / span]
      : [0, 0];
  const at = turn.moving.at;
  return {
    ...turn,
    phase: 'flying',
    target: turns(turn, at, speed) ? turn.done : turn.from,
    time,
    moving: { at, speed },
    samples: [],
  };
}

/** Caught in flight: it stops where it is, held, and follows the hand from there. */
export function catchCurl(turn: CurlTurn): CurlTurn {
  if (turn.phase !== 'flying') return turn;
  const at = turn.moving.at;
  return {
    ...turn,
    phase: 'held',
    target: null,
    arc: null,
    grab: at,
    samples: [],
    moving: { at, speed: [0, 0] },
  };
}

/** How far over a corner at `x` is, 0 at its start to 1 landed. */
const progressOf = (turn: CurlTurn, x: number): number =>
  Math.min(
    1,
    Math.max(0, (turn.way > 0 ? turn.rest[0] - x : x - turn.from[0]) / (2 * turn.page.width)),
  );

/** `elapsed` milliseconds of flight: the spring carries it, and it lands once there. */
export function tickCurl(turn: CurlTurn, elapsed: number): CurlTurn {
  if (turn.phase !== 'flying' || !turn.target) return turn;
  const { arc } = turn;
  const step = springStep(
    turn.moving,
    turn.target,
    omegaFor(turn.time),
    elapsed,
    arc ? (x) => arcHeight(arc, turn.rest[1], turn.page.height, progressOf(turn, x)) : undefined,
  );
  return { ...turn, moving: step.moving, phase: step.landed ? 'landed' : 'flying' };
}

/** Finished now, where it was going (a key pressed mid-turn): reading fast never waits on it. */
export function finishCurl(turn: CurlTurn): CurlTurn {
  const target = turn.target ?? turn.done;
  return { ...turn, phase: 'landed', target, moving: { at: target, speed: [0, 0] } };
}

/** Whether it landed turned (rather than fallen back). */
export const turned = (turn: CurlTurn): boolean =>
  turn.phase === 'landed' && turn.target === turn.done;
