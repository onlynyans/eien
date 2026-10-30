import { describe, expect, it } from 'vitest';
import { curlFrame } from './curl-frame';
import {
  CURL_STRIPS,
  corners,
  cut,
  heldAt,
  lay,
  onFold,
  type Point,
  radiusAt,
  rolledAt,
  rollOf,
  spineDown,
  transform,
} from './turn-curl';
import { glintAt, shadeAt } from './turn-light';

const page = { width: 400, height: 600 };
const rest: Point = [400, 500];
const lengths = { cast: 32, crest: 24 };

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
    const { matrix } = lay(page, roll, from, to);
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

describe('a polygon cut by a line', () => {
  it('keeps the side the normal points to, with the line’s crossings', () => {
    expect(cut(corners(page), [100, 0], [1, 0])).toEqual([
      [100, 0],
      [400, 0],
      [400, 600],
      [100, 600],
    ]);
    expect(cut(corners(page), [1000, 0], [1, 0])).toEqual([]);
  });
});

describe('the light', () => {
  it('shades a strip by how it faces you: none flat, darkest edge-on', () => {
    expect(shadeAt(0)).toBeCloseTo(0, 9);
    expect(shadeAt(Math.PI / 2)).toBeCloseTo(1, 9);
    expect(shadeAt(Math.PI)).toBeCloseTo(0, 9);
  });

  it('glints just past the crest, nowhere near its start', () => {
    expect(glintAt(0.78 * Math.PI)).toBeCloseTo(1, 9);
    expect(glintAt(0)).toBe(0);
  });
});

describe('a frame', () => {
  it('draws nothing at rest', () => {
    expect(curlFrame(page, rest, rest, lengths)).toEqual({ resting: true, corner: rest });
  });

  it('half over: what stays, twelve strips (the back half glinting), what lies back, the shadow beneath', () => {
    const frame = curlFrame(page, rest, [0, 500], lengths);
    if (frame.resting) throw new Error('moving');
    expect(frame.strips).toHaveLength(CURL_STRIPS);
    expect(frame.strips.filter((strip) => strip.back)).toHaveLength(CURL_STRIPS / 2);
    expect(frame.strips.every((strip) => (strip.glint !== null) === strip.back)).toBe(true);
    expect(frame.front.length).toBeGreaterThan(2);
    expect(frame.cast.clip.length).toBeGreaterThan(2);
    // The shadow runs the cast's length from the fold, the crest's light its own.
    const [, whole, gone] = frame.cast.light.stops;
    expect((gone?.at ?? 0) - (whole?.at ?? 0)).toBeCloseTo(lengths.cast, 9);
    const crest = frame.back.light.stops;
    expect((crest[2]?.at ?? 0) - (crest[1]?.at ?? 0)).toBeCloseTo(lengths.crest, 9);
  });

  it('a crease too slight to round draws no strips', () => {
    const frame = curlFrame(page, rest, [399, 500], lengths);
    if (frame.resting) throw new Error('moving');
    expect(frame.strips).toEqual([]);
  });
});
