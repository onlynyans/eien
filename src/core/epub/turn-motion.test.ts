import { describe, expect, it } from 'vitest';
import {
  beginCurl,
  catchCurl,
  dragCurl,
  finishCurl,
  keyCurl,
  letGoCurl,
  THROW_MS,
  tickCurl,
  turned,
} from './curl-turn';
import { curlTime, isInstant, SLOWEST, slideTime, turnScale, wordsTime } from './turn-speed';
import { omegaFor, settled, springStep } from './turn-spring';
import { arcHeight, FIRST_STROKE, nextStroke, STROKE_BOUNDS } from './turn-stroke';

const page = { width: 400, height: 600 };
const fly = (turn: ReturnType<typeof beginCurl>, limit = 2000) => {
  let at = turn;
  for (let t = 0; t < limit && at.phase === 'flying'; t += 16) at = tickCurl(at, 16);
  return at;
};

describe('the speed', () => {
  it('scales the designed time from instant to four times slower, as designed when unreadable', () => {
    expect(turnScale(0)).toBe(0);
    expect(turnScale(2)).toBe(2);
    expect(turnScale(9)).toBe(SLOWEST);
    expect(turnScale(-1)).toBe(0);
    expect(turnScale(Number.NaN)).toBe(1);
  });

  it('times each motion from the tokens’ calm and quick', () => {
    expect(curlTime(220, 2)).toBe(660);
    expect(curlTime(220, 1, 1.1)).toBeCloseTo(363, 9);
    expect(slideTime(220, 2)).toBe(440);
    expect(wordsTime(120, 220, 1)).toEqual({ out: 120, in: 220 });
  });

  it('is instant at speed 0 and under reduced motion (the tokens at 0)', () => {
    expect(isInstant(curlTime(220, 0))).toBe(true);
    expect(isInstant(curlTime(0, 2))).toBe(true);
    expect(isInstant(slideTime(220, 1))).toBe(false);
  });
});

describe('the spring', () => {
  it('lands a two-page move within its time, never past', () => {
    const time = curlTime(220, 1);
    let moving = { at: [400, 0] as const, speed: [0, 0] as const } as const;
    let landed = false;
    let spent = 0;
    while (!landed && spent < 5 * time) {
      const step = springStep(moving, [-400, 0], omegaFor(time), 16);
      moving = step.moving as typeof moving;
      landed = step.landed;
      spent += 16;
      expect(moving.at[0]).toBeGreaterThanOrEqual(-400);
    }
    expect(landed).toBe(true);
    expect(spent).toBeLessThanOrEqual(time + 16);
  });

  it('stops on its mark when thrown past it, rather than bouncing', () => {
    const step = springStep({ at: [-390, 0], speed: [-5, 0] }, [-400, 0], omegaFor(330), 16);
    expect(step).toEqual({ moving: { at: [-400, 0], speed: [0, 0] }, landed: true });
  });

  it('is there at once for an instant finish', () => {
    expect(springStep({ at: [400, 0], speed: [0, 0] }, [-400, 0], omegaFor(0), 16).landed).toBe(
      true,
    );
  });

  it('counts a stalled frame as a short one, so the page never leaps', () => {
    const long = springStep({ at: [400, 0], speed: [0, 0] }, [-400, 0], omegaFor(330), 5000);
    const capped = springStep({ at: [400, 0], speed: [0, 0] }, [-400, 0], omegaFor(330), 48);
    expect(long).toEqual(capped);
  });

  it('knows when it has settled', () => {
    expect(settled({ at: [0.2, 0], speed: [0.01, 0] }, [0, 0])).toBe(true);
    expect(settled({ at: [0.2, 0], speed: [0.5, 0] }, [0, 0])).toBe(false);
  });
});

describe('a key’s stroke', () => {
  it('starts at the middle of its bounds', () => {
    expect(FIRST_STROKE.grip).toBeCloseTo(0.84, 9);
    expect(FIRST_STROKE.pace).toBeCloseTo(1, 9);
  });

  it('turns back at a bound rather than holding there', () => {
    const atTop = { ...FIRST_STROKE, grip: STROKE_BOUNDS.grip[1] };
    const next = nextStroke(atTop, () => 1 - Number.EPSILON);
    expect(next.grip).toBeLessThan(STROKE_BOUNDS.grip[1]);
  });

  it('rises on its arc and lands where it was taken', () => {
    expect(arcHeight(FIRST_STROKE, 500, 600, 0)).toBe(500);
    expect(arcHeight(FIRST_STROKE, 500, 600, 1)).toBeCloseTo(500, 9);
    expect(arcHeight(FIRST_STROKE, 500, 600, 0.5)).toBeLessThan(500);
  });
});

describe('a curl’s states', () => {
  it('a key’s turn flies at once on its arc and lands turned', () => {
    const turn = keyCurl(page, 1, FIRST_STROKE, curlTime(220, 1));
    expect(turn.phase).toBe('flying');
    expect(turn.moving.speed[0]).toBeLessThan(0);
    const mid = tickCurl(turn, 48);
    expect(mid.moving.at[1]).toBeLessThan(turn.rest[1]);
    const landed = fly(turn);
    expect(landed.phase).toBe('landed');
    expect(turned(landed)).toBe(true);
    expect(landed.moving.at).toEqual(landed.done);
  });

  it('held, the corner follows the hand one to one; back, twice the hand’s way', () => {
    const on = dragCurl(beginCurl(page, 1, 500), [-50, -10], 0);
    expect(on.moving.at).toEqual([350, 490]);
    const back = dragCurl(beginCurl(page, -1, 500), [50, 0], 0);
    expect(back.moving.at).toEqual([-300, 500]);
  });

  it('let go slowly short of a quarter, it falls back; past it, it turns', () => {
    const slow = (x: number) => {
      let turn = beginCurl(page, 1, 500);
      turn = dragCurl(turn, [x, 0], 0);
      turn = dragCurl(turn, [x, 0], THROW_MS);
      return fly(letGoCurl(turn, 300));
    };
    expect(turned(slow(-100))).toBe(false);
    expect(slow(-100).moving.at).toEqual([400, 500]);
    expect(turned(slow(-350))).toBe(true);
  });

  it('a flick turns it from a few centimetres in', () => {
    let turn = beginCurl(page, 1, 500);
    turn = dragCurl(turn, [-10, 0], 0);
    turn = dragCurl(turn, [-90, 0], 40);
    expect(turned(fly(letGoCurl(turn, 300)))).toBe(true);
  });

  it('keeps only the last moments of the hand for its speed', () => {
    let turn = beginCurl(page, 1, 500);
    for (let t = 0; t <= 400; t += 20) turn = dragCurl(turn, [-t / 4, 0], t);
    expect(turn.samples.every((sample) => 400 - sample.time <= THROW_MS)).toBe(true);
  });

  it('caught in flight, it stops where it is and is held from there', () => {
    const flying = tickCurl(keyCurl(page, 1, FIRST_STROKE, 330), 48);
    const caught = catchCurl(flying);
    expect(caught.phase).toBe('held');
    expect(caught.moving).toEqual({ at: flying.moving.at, speed: [0, 0] });
    expect(caught.arc).toBeNull();
    expect(dragCurl(caught, [-20, 0], 0).moving.at[0]).toBeCloseTo(flying.moving.at[0] - 20, 9);
  });

  it('finished mid-flight, it lands where it was going at once', () => {
    const finished = finishCurl(tickCurl(keyCurl(page, -1, FIRST_STROKE, 330), 16));
    expect(finished.phase).toBe('landed');
    expect(turned(finished)).toBe(true);
    expect(finished.moving.at).toEqual(finished.rest);
  });

  it('an instant finish lands on its first tick', () => {
    let turn = dragCurl(beginCurl(page, 1, 500), [-300, 0], 0);
    turn = letGoCurl(turn, 0);
    expect(tickCurl(turn, 0).phase).toBe('landed');
  });

  it('ignores a drag once let go, and a let go while not held', () => {
    const flying = keyCurl(page, 1, FIRST_STROKE, 330);
    expect(dragCurl(flying, [10, 10], 0)).toBe(flying);
    expect(letGoCurl(flying, 0)).toBe(flying);
    const held = beginCurl(page, 1, 500);
    expect(catchCurl(held)).toBe(held);
    expect(tickCurl(held, 16)).toBe(held);
  });
});
