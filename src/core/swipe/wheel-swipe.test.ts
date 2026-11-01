import { describe, expect, it } from 'vitest';
import { ACROSS, EVENTS, QUIET_MS, type SwipeWay, WheelSwipe } from './wheel-swipe';

/** Wheel events a frame apart from `start`, each [dx, dy]: the ways swiped. */
function run(swipe: WheelSwipe, deltas: readonly (readonly [number, number])[], start = 0) {
  const ways: SwipeWay[] = [];
  deltas.forEach(([dx, dy], at) => {
    const way = swipe.wheel(dx, dy, start + at * 16);
    if (way) ways.push(way);
  });
  return ways;
}
const across = (dx: number, count: number) => Array.from({ length: count }, () => [dx, 0] as const);
/** A trackpad's flick: the fingers rising to `peak`, then the glide dying away. */
const flick = (peak: number, sign = -1): [number, number][] => {
  const deltas: [number, number][] = [];
  for (let step = 1; step <= 5; step += 1) deltas.push([(sign * peak * step) / 5, 0]);
  for (let glide = peak * 0.9; glide > 0.3; glide *= 0.9) deltas.push([sign * glide, 0]);
  return deltas;
};

describe('two fingers across a trackpad, read from the wheel (#70)', () => {
  it('swipes back when the page is pulled to the right, and on the other way', () => {
    expect(run(new WheelSwipe(), across(-10, 20))).toEqual(['back']);
    expect(run(new WheelSwipe(), across(10, 20))).toEqual(['on']);
  });

  it('swipes once it has gone far enough across, not before', () => {
    const swipe = new WheelSwipe();
    expect(run(swipe, across(-10, ACROSS / 10 - 1))).toEqual([]);
    expect(swipe.wheel(-10, 0, (ACROSS / 10 - 1) * 16)).toBe('back');
  });

  it('never swipes for a scroll drifting sideways', () => {
    expect(
      run(
        new WheelSwipe(),
        across(-10, 40).map(([dx]) => [dx, 25] as const),
      ),
    ).toEqual([]);
  });

  it('never swipes for a notch or two of a wheel', () => {
    const swipe = new WheelSwipe();
    expect(run(swipe, across(-200, EVENTS - 1))).toEqual([]);
  });

  it('swipes once for a flick and the whole of its glide', () => {
    expect(run(new WheelSwipe(), flick(40))).toEqual(['back']);
  });

  it('swipes again for a new swipe after a quiet', () => {
    const swipe = new WheelSwipe();
    expect(run(swipe, across(-20, 10))).toEqual(['back']);
    expect(run(swipe, across(-20, 10), 160 + QUIET_MS)).toEqual(['back']);
  });

  it('swipes again for a swipe rising in a glide that has died down', () => {
    expect(run(new WheelSwipe(), [...flick(40), ...flick(40)])).toEqual(['back', 'back']);
  });

  it('a stroke slowing for a moment and speeding up again is still one', () => {
    const slow = [...across(-20, 8), [-3, 0], [-3, 0], ...across(-20, 8)] as const;
    expect(run(new WheelSwipe(), slow)).toEqual(['back']);
  });

  it('never swipes for a gesture that was something else’s', () => {
    const swipe = new WheelSwipe();
    swipe.pass(0);
    expect(run(swipe, across(-20, 10), 16)).toEqual([]);
  });
});
