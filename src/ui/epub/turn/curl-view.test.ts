import { afterEach, describe, expect, it } from 'vitest';
import { CURL_STRIPS, curlFrame } from '../../../core/epub';
import { CurlView, clipOf, gradientOf } from './curl-view';
import { pageCopy } from './page-copy';
import { millisecondsOf, turnTokens } from './turn-tokens';

const page = { width: 400, height: 600 };
const lengths = { cast: 32, crest: 24 };

function sheet(): HTMLElement {
  const element = document.createElement('article');
  element.innerHTML = '<p class="words">Words</p>';
  document.body.append(element);
  return element;
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('the curl drawn', () => {
  it('lays the page as its pieces: what stays, twelve strips, what lies back, all in the curl’s inks', () => {
    const to = sheet();
    const view = new CurlView(pageCopy(to, '.words'), to, 1, null);
    view.draw(curlFrame(page, [400, 500], [0, 500], lengths));
    const strips = view.element.querySelectorAll<HTMLElement>('.turn-curl__strip');
    expect(strips).toHaveLength(CURL_STRIPS);
    expect(strips[0]?.style.transform).toMatch(/^matrix\(/);
    expect(strips[0]?.style.clipPath).toMatch(/^polygon\(/);
    expect(view.element.querySelectorAll('.turn-curl__glint')).toHaveLength(CURL_STRIPS / 2);
  });

  it('at rest, shows the page flat and nothing else', () => {
    const to = sheet();
    const view = new CurlView(pageCopy(to, '.words'), to, 1, null);
    view.draw(curlFrame(page, [400, 500], [400, 500], lengths));
    const flap = view.element.querySelector<HTMLElement>('.turn-curl__flap');
    expect(flap?.style.visibility).toBe('hidden');
  });

  it('stacks its pieces in order, whatever the page’s own rules would', () => {
    const to = sheet();
    const view = new CurlView(pageCopy(to, '.words'), to, -1, pageCopy(to, '.words'));
    const order = [...view.element.children].map((child) => (child as HTMLElement).style.zIndex);
    expect(order[0]).toBe('0');
    expect(order.slice(1)).toEqual(order.slice(1).map((_, i) => String(i + 1)));
    view.remove();
    expect(view.element.isConnected).toBe(false);
    expect(to.style.visibility).toBe('');
  });
});

describe('its CSS', () => {
  it('wears a light as the ink at each stop’s strength, never a colour of its own', () => {
    const light = {
      angle: 90,
      stops: [
        { at: 10, strength: 0 },
        { at: 42, strength: 1 },
      ],
    };
    expect(gradientOf(light, 'var(--eien-curl-shade)')).toBe(
      'linear-gradient(90.00deg, color-mix(in srgb, var(--eien-curl-shade) 0.0%, transparent) 10.0px, color-mix(in srgb, var(--eien-curl-shade) 100.0%, transparent) 42.0px)',
    );
  });

  it('clips to a polygon, and hides what an empty one clips', () => {
    expect(
      clipOf([
        [0, 0],
        [10, 0],
        [10, 5],
      ]),
    ).toBe('polygon(0.00px 0.00px, 10.00px 0.00px, 10.00px 5.00px)');
    expect(clipOf([])).toBe('polygon(0 0, 0 0, 0 0)');
  });
});

describe('the turn’s tokens', () => {
  it('reads times in either unit, and none as instant', () => {
    expect(millisecondsOf('220ms')).toBe(220);
    expect(millisecondsOf(' 0.22s')).toBeCloseTo(220, 9);
    expect(millisecondsOf('0ms')).toBe(0);
    expect(millisecondsOf('')).toBeNaN();
  });

  it('reads them from the sheet, reduced motion’s 0 among them', () => {
    const element = sheet();
    element.style.setProperty('--eien-calm', '0ms');
    element.style.setProperty('--eien-quick', '0ms');
    element.style.setProperty('--eien-space-2', '8px');
    const tokens = turnTokens(element);
    expect(tokens.calm).toBe(0);
    expect(tokens.step).toBe(8);
  });
});
