import { describe, expect, it } from 'vitest';
import {
  heldAt,
  lay,
  onFold,
  type Point,
  radiusAt,
  rolledAt,
  rollOf,
  spineDown,
  transform,
} from './curl';

const page = { width: 400, height: 600 };
const rest: Point = [400, 500];

describe('the roll', () => {
  it('is flat at rest and once turned, roundest half way, a fifth of the width', () => {
    expect(radiusAt(page, 0)).toBe(0);
    expect(radiusAt(page, 2 * page.width)).toBeCloseTo(0, 9);
    expect(radiusAt(page, page.width)).toBeCloseTo(page.width / 5, 9);
    expect(radiusAt(page, page.width / 2)).toBeLessThan(radiusAt(page, page.width));
  });

  it('folds where the corner lands: (travel + πr) / 2 of paper back from its rest', () => {
    const roll = rollOf(page, rest, [100, 500]);
    expect(roll.normal).toEqual([1, 0]);
    expect(roll.travel).toBe(300);
    expect(roll.fold[0]).toBeCloseTo(400 - (300 + Math.PI * roll.radius) / 2, 9);
    // The corner's paper, rolled, lies where the hand holds it.
    const paper = rest[0] - roll.fold[0];
    expect(roll.fold[0] + rolledAt(paper, roll.radius)).toBeCloseTo(100, 6);
  });

  it('rolls round the cylinder, then back on itself', () => {
    expect(rolledAt(0, 10)).toBe(0);
    expect(rolledAt((Math.PI * 10) / 2, 10)).toBeCloseTo(10, 9);
    expect(rolledAt(Math.PI * 10, 10)).toBeCloseTo(0, 9);
    expect(rolledAt(Math.PI * 10 + 50, 10)).toBeCloseTo(-50, 9);
    expect(rolledAt(30, 0)).toBe(-30);
  });

  it('lays a strip with its ends where the roll puts them', () => {
    const roll = rollOf(page, rest, [100, 500]);
    const [from, to] = [5, 15];
    const matrix = lay(roll, from, to);
    for (const s of [from, to]) {
      const laid = transform(matrix, onFold(roll, s));
      expect(laid[0]).toBeCloseTo(roll.fold[0] + rolledAt(s, roll.radius), 6);
      expect(laid[1]).toBeCloseTo(roll.fold[1], 6);
    }
  });
});

describe('the paper never stretches', () => {
  it('keeps the spine down: the corner stops where it would lift', () => {
    const far: Point = [-900, -400];
    expect(spineDown(page, rest, far)).toBe(false);
    const held = heldAt(page, rest, far);
    expect(spineDown(page, rest, held)).toBe(true);
    expect(held).not.toEqual(rest);
  });

  it('leaves the hand where it is while the spine stays down', () => {
    expect(heldAt(page, rest, [200, 480])).toEqual([200, 480]);
  });
});
