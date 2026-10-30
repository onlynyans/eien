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
import { curlTime } from './speed';
import { FIRST_STROKE } from './stroke';

const page = { width: 400, height: 600 };
const fly = (turn: ReturnType<typeof beginCurl>, limit = 2000) => {
  let at = turn;
  for (let t = 0; t < limit && at.phase === 'flying'; t += 16) at = tickCurl(at, 16);
  return at;
};

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
