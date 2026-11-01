// What holds for any turn (#40, Phase 3): a key's arc never leaves its
// bounds nor jumps, the spring never carries the corner past its mark, the
// spine never lifts, a frame stays on its page, and speed 0 is instant.

import fc from 'fast-check';
import { describe, it } from 'vitest';
import { heldAt, type Point, spineDown } from './curl';
import { curlFrame } from './curl-frame';
import { keyCurl, tickCurl } from './curl-turn';
import { curlTime, isInstant, slideTime, wordsTime } from './speed';
import { omegaFor, springStep } from './spring';
import { FIRST_STROKE, nextStroke, STROKE_BOUNDS, type Stroke, WANDER } from './stroke';

const box = fc.record({
  width: fc.double({ min: 120, max: 1600, noNaN: true }),
  height: fc.double({ min: 160, max: 2400, noNaN: true }),
});
const unit = fc.double({ min: 0, max: 1, maxExcluded: true, noNaN: true });

describe('a key’s strokes', () => {
  it('stay in their bounds, each step at most a third of the range', () => {
    fc.assert(
      fc.property(fc.array(unit, { minLength: 4, maxLength: 400 }), (draws) => {
        let at = 0;
        let last: Stroke = FIRST_STROKE;
        for (let turn = 0; turn < draws.length / 4; turn++) {
          const next = nextStroke(last, () => draws[at++ % draws.length] as number);
          for (const part of Object.keys(STROKE_BOUNDS) as (keyof Stroke)[]) {
            const [low, high] = STROKE_BOUNDS[part];
            if (next[part] < low || next[part] > high) return false;
            if (Math.abs(next[part] - last[part]) > (high - low) * WANDER + 1e-12) return false;
          }
          last = next;
        }
        return true;
      }),
    );
  });

  it('each turn rises above where it was taken and lands there, within its arc', () => {
    fc.assert(
      fc.property(box, fc.array(unit, { minLength: 4, maxLength: 4 }), (page, draws) => {
        const stroke = nextStroke(FIRST_STROKE, () => draws.shift() ?? 0.5);
        let turn = keyCurl(page, 1, stroke, curlTime(220, 1, stroke.pace));
        const taken = turn.rest[1];
        let highest = taken;
        for (let t = 0; t < 4000 && turn.phase === 'flying'; t += 16) {
          turn = tickCurl(turn, 16);
          const y = turn.moving.at[1];
          if (y > taken + 1e-9 || y < taken - stroke.lift * page.height - 1e-9) return false;
          highest = Math.min(highest, y);
        }
        return turn.phase === 'landed' && highest < taken && turn.moving.at[1] === taken;
      }),
    );
  });
});

describe('the spring', () => {
  it('never carries the corner past its mark, from any start, speed and frame', () => {
    const point = fc.tuple(
      fc.double({ min: -3000, max: 3000, noNaN: true }),
      fc.double({ min: -3000, max: 3000, noNaN: true }),
    );
    fc.assert(
      fc.property(
        point,
        point,
        point.map(([x, y]) => [x / 100, y / 100] as Point),
        fc.double({ min: 0, max: 2000, noNaN: true }),
        fc.array(fc.double({ min: 0, max: 200, noNaN: true }), { minLength: 1, maxLength: 60 }),
        (start, target, speed, time, frames) => {
          const omega = omegaFor(time);
          let moving = { at: start as Point, speed };
          // Each step stays on its side of the mark, as the guard holds it: it lands, never crosses.
          for (const frame of frames) {
            const was = moving.at;
            const step = springStep(moving, target, omega, frame);
            moving = step.moving;
            const ahead =
              (moving.at[0] - target[0]) * (was[0] - target[0]) +
              (moving.at[1] - target[1]) * (was[1] - target[1]);
            if (ahead < 0) return false;
            if (step.landed) return moving.at[0] === target[0] && moving.at[1] === target[1];
          }
          return true;
        },
      ),
    );
  });
});

describe('the paper', () => {
  it('never lifts the spine, wherever the hand pulls', () => {
    fc.assert(
      fc.property(
        box,
        unit,
        fc.tuple(
          fc.double({ min: -4, max: 2, noNaN: true }),
          fc.double({ min: -2, max: 3, noNaN: true }),
        ),
        (page, grip, [hx, hy]) => {
          const rest: Point = [page.width, grip * page.height];
          const held = heldAt(page, rest, [hx * page.width, hy * page.height]);
          return spineDown(page, rest, held);
        },
      ),
    );
  });

  it('keeps every clip of a frame on its page', () => {
    fc.assert(
      fc.property(box, unit, unit, unit, (page, grip, x, y) => {
        const frame = curlFrame(
          page,
          [page.width, grip * page.height],
          [(2 * x - 1) * page.width, y * page.height],
          { cast: 32, crest: 24 },
        );
        if (frame.resting) return true;
        const clips = [
          frame.front,
          frame.cast.clip,
          frame.back.clip,
          ...frame.strips.map((s) => s.clip),
        ];
        const on = ([px, py]: Point) =>
          px >= -1e-6 && px <= page.width + 1e-6 && py >= -1e-6 && py <= page.height + 1e-6;
        return clips.every((clip) => clip.every(on));
      }),
    );
  });
});

describe('the speed', () => {
  it('at 0, or with the tokens at 0 (reduced motion), every motion is instant', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1000, noNaN: true }),
        fc.double({ min: 0, max: 4, noNaN: true }),
        (token, scale) =>
          [
            curlTime(token, 0),
            slideTime(token, 0),
            wordsTime(token, token, 0).in,
            curlTime(0, scale),
            slideTime(0, scale),
            wordsTime(0, 0, scale).out,
          ].every(isInstant),
      ),
    );
  });
});
