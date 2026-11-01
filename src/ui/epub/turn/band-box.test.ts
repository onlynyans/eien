import { afterEach, describe, expect, it } from 'vitest';
import { BAND_BOX, curlFrame, type Matrix, type Point } from '../../../core/epub';
import { BandBox, part } from './band-box';

const page = { width: 400, height: 600 };
const reach = 1000;

/** `a` after `b`. */
const times = (a: Matrix, b: Matrix): Matrix => [
  a[0] * b[0] + a[2] * b[1],
  a[1] * b[0] + a[3] * b[1],
  a[0] * b[2] + a[2] * b[3],
  a[1] * b[2] + a[3] * b[3],
  a[0] * b[4] + a[2] * b[5] + a[4],
  a[1] * b[4] + a[3] * b[5] + a[5],
];

const transform = (m: Matrix, [x, y]: Point): Point => [
  m[0] * x + m[2] * y + m[4],
  m[1] * x + m[3] * y + m[5],
];

/** A transform as written, `matrix(…)`, as its matrix. */
const matrixOf = (written: string): Matrix =>
  (/^matrix\(([^)]*)\)$/.exec(written)?.[1] ?? '')
    .split(',')
    .map((n) => Number.parseFloat(n)) as unknown as Matrix;

const near = (a: Point, b: Point) => {
  expect(Math.hypot(a[0] - b[0], a[1] - b[1])).toBeLessThan(1e-6);
};

afterEach(() => {
  document.body.replaceChildren();
});

describe('a band drawn', () => {
  // A style written again is drawn again, each frame on a phone, even when it says the same.
  it('writes whether it’s shown only when that changes', () => {
    const band = new BandBox('strip', page, reach);
    document.body.append(band.element);
    const watch = new MutationObserver(() => {});
    watch.observe(band.element, { attributes: true, attributeFilter: ['style'] });
    band.show(true);
    band.show(false);
    band.show(false);
    band.show(false);
    band.show(true);
    band.show(true);
    const writes = watch.takeRecords();
    watch.disconnect();
    expect(writes).toHaveLength(2);
    expect(band.element.style.visibility).toBe('');
  });

  // The ramp runs across what's over the band (rampOf), so that must lie on the band's own box:
  // its cuts, wherever the roll lays it.
  it('lays what’s over its page on the band’s box', () => {
    const frame = curlFrame(page, [400, 500], [150, 420], { cast: 32, crest: 24 });
    // A strip of the roll: laid by the roll, not only moved.
    const placed = frame.resting ? undefined : frame.strips[3];
    if (!placed) throw new Error('no strip');
    const band = new BandBox('strip', page, reach, { over: [part('tone')] });
    band.place(placed);
    const inside = band.element.querySelector<HTMLElement>('.turn-curl__inside');
    const over = band.element.querySelector<HTMLElement>('.turn-curl__over');
    if (!inside || !over) throw new Error('no inside or over');
    expect(over.style.width).toBe(`${BAND_BOX}px`);
    const element = matrixOf(band.element.style.transform);
    const drawn = times(
      element,
      times(matrixOf(inside.style.transform), matrixOf(over.style.transform)),
    );
    for (const v of [0, reach, 2 * reach]) {
      near(transform(drawn, [0, v]), transform(element, [0, v]));
      near(transform(drawn, [BAND_BOX, v]), transform(element, [BAND_BOX, v]));
    }
  });

  // A page's back: its own paper over the copy, beneath the band's shade and light, all cut to the
  // page's box (the inside). The paper is the page's size, never scaled with the band.
  it('veils its copy inside the page’s box, between the copy and its shade', () => {
    const copy = document.createElement('article');
    const band = new BandBox('strip', page, reach, {
      page: [copy],
      veiled: true,
      over: [part('tone')],
    });
    const inside = band.element.querySelector<HTMLElement>('.turn-curl__inside');
    expect([...(inside?.children ?? [])].map((child) => child.className)).toEqual([
      '',
      'turn-curl__paper',
      'turn-curl__over',
    ]);
    expect(inside?.style.width).toBe('400px');
    expect(inside?.style.height).toBe('600px');
  });
});
