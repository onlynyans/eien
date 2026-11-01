// What holds for any turn (#40, Phase 3): a key's arc never leaves its
// bounds nor jumps, the spring never carries the corner past its mark, the
// spine never lifts, a frame's bands cross the whole page, and speed 0 is instant.

import fc from 'fast-check';
import { describe, it } from 'vitest';
import { BAND_BOX } from './band';
import {
  CURL_STRIPS,
  dot,
  heldAt,
  minus,
  type Point,
  rollOf,
  SEAM,
  spineDown,
  transform,
} from './curl';
import { curlFrame, reachOf } from './curl-frame';
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

  // A band is cut only by its own edges across the fold, never along it: every corner of the page
  // lies within its reach either side, wherever the fold is.
  it('reaches every band across the whole page, along its fold', () => {
    fc.assert(
      fc.property(box, unit, unit, unit, (page, grip, x, y) => {
        const frame = curlFrame(
          page,
          [page.width, grip * page.height],
          [(2 * x - 1) * page.width, y * page.height],
          { cast: 32, crest: 24 },
        );
        if (frame.resting) return true;
        const reach = 2 * reachOf(page);
        const corners: Point[] = [
          [0, 0],
          [page.width, 0],
          [page.width, page.height],
          [0, page.height],
        ];
        // The page's corners in each band's box (where its paper puts them): within its length.
        return [frame.front, frame.cast, frame.back, frame.crest, ...frame.strips].every((band) => {
          return corners.every((corner) => {
            const along = transform(band.paper, corner)[1];
            return along >= 0 && along <= reach;
          });
        });
      }),
    );
  });
});

// A band's box holds a point of the page exactly where its cuts across the fold say: what stays up
// to the fold, each strip its own part of the roll (and a hair either side), what lies back past it.
describe('a frame’s bands', () => {
  it('each hold the page between their cuts, and nothing else of it', () => {
    fc.assert(
      fc.property(box, unit, unit, unit, unit, unit, (page, grip, x, y, px, py) => {
        const rest: Point = [page.width, grip * page.height];
        const frame = curlFrame(page, rest, [(2 * x - 1) * page.width, y * page.height], {
          cast: 32,
          crest: 24,
        });
        if (frame.resting) return true;
        const roll = rollOf(page, rest, frame.corner);
        const point: Point = [px * page.width, py * page.height];
        const past = dot(minus(point, roll.fold), roll.normal);
        const height = 2 * reachOf(page);
        const holds = (band: (typeof frame.strips)[number]) => {
          const [u, v] = transform(band.paper, point);
          return u >= 0 && u <= BAND_BOX && v >= 0 && v <= height;
        };
        // Points on a cut, within rounding, could fall either way.
        const near = (at: number) => Math.abs(past - at) < 1e-6;
        const half = Math.PI * roll.radius;
        const step = half / CURL_STRIPS;
        const cuts = [
          SEAM,
          half - SEAM,
          ...frame.strips.flatMap((_, i) => [i * step - SEAM, (i + 1) * step + SEAM]),
        ];
        if (cuts.some(near)) return true;
        return (
          holds(frame.front) === past <= SEAM &&
          holds(frame.back) === past >= half - SEAM &&
          frame.strips.every(
            (strip, i) =>
              holds(strip) === (past >= i * step - SEAM && past <= (i + 1) * step + SEAM),
          )
        );
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
