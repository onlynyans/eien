import { describe, expect, it } from 'vitest';
import { curlTime } from './speed';
import { omegaFor, settled, springStep } from './spring';

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
