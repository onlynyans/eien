// What holds for any trackpad flick read from the wheel (#70): it swipes once
// or not at all, however long its glide, and two flicks with the glide dead
// between them swipe twice.

import fc from 'fast-check';
import { describe, it } from 'vitest';
import { ACROSS, STEEP, WheelSwipe } from './wheel-swipe';

/** A flick: rising over `rise` events to `peak`, then a glide falling by `decay` each frame. */
const flickOf = (peak: number, rise: number, decay: number, sign: number, drift: number) => {
  const deltas: [number, number][] = [];
  for (let step = 1; step <= rise; step += 1) deltas.push([(sign * peak * step) / rise, drift]);
  for (let glide = peak * decay; glide > 0.3; glide *= decay) deltas.push([sign * glide, drift]);
  return deltas;
};
const flicks = fc.record({
  peak: fc.double({ min: 2, max: 80, noNaN: true }),
  rise: fc.integer({ min: 3, max: 12 }),
  decay: fc.double({ min: 0.8, max: 0.97, noNaN: true }),
  sign: fc.constantFrom(-1, 1),
  drift: fc.double({ min: -1, max: 1, noNaN: true }),
});
const swipes = (deltas: readonly [number, number][]) => {
  const swipe = new WheelSwipe();
  return deltas.filter(([dx, dy], at) => swipe.wheel(dx, dy, at * 16) !== null).length;
};
const reach = (deltas: readonly [number, number][]) => {
  let x = 0;
  let y = 0;
  let most = 0;
  for (const [dx, dy] of deltas) {
    x += dx;
    y += dy;
    if (Math.abs(x) >= STEEP * Math.abs(y)) most = Math.max(most, Math.abs(x));
  }
  return most;
};

describe('a flick read from the wheel', () => {
  it('swipes once if it goes far enough across, else never, glide and all', () => {
    fc.assert(
      fc.property(flicks, ({ peak, rise, decay, sign, drift }) => {
        const deltas = flickOf(peak, rise, decay, sign, drift);
        return swipes(deltas) === (reach(deltas) >= ACROSS ? 1 : 0);
      }),
    );
  });

  it('two far flicks swipe twice when the first’s glide has died between them', () => {
    fc.assert(
      fc.property(flicks, flicks, (one, two) => {
        const first = flickOf(one.peak, one.rise, one.decay, one.sign, 0);
        const second = flickOf(two.peak, two.rise, two.decay, two.sign, 0);
        fc.pre(reach(first) >= ACROSS && reach(second) >= ACROSS);
        // The second rises past twice the dead glide in its first step: a stroke, not a jitter.
        fc.pre(two.peak / two.rise >= 8);
        return swipes([...first, ...second]) === 2;
      }),
    );
  });
});
