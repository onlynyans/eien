import { afterEach, describe, expect, it } from 'vitest';
import { CURL_STRIPS, curlFrame } from '../../../core/epub';
import { rampOf } from './band-box';
import { CurlView } from './curl-view';
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
  it('lays the page as its bands: what stays, twelve strips, what lies back, each moved, none clipped', () => {
    const to = sheet();
    const view = new CurlView(pageCopy(to, '.words'), to, 1, '.words');
    view.draw(curlFrame(page, [400, 500], [0, 500], lengths));
    const strips = view.element.querySelectorAll<HTMLElement>('.turn-curl__strip');
    expect(strips).toHaveLength(CURL_STRIPS);
    for (const strip of strips) {
      expect(strip.style.transform).toMatch(/^matrix\(/);
      expect(strip.querySelector<HTMLElement>('.turn-curl__inside')?.style.transform).toMatch(
        /^matrix\(/,
      );
    }
    expect(view.element.querySelectorAll('.turn-curl__glint')).toHaveLength(CURL_STRIPS / 2);
    expect(view.element.querySelectorAll('[style*="clip-path"]')).toHaveLength(0);
  });

  // What keeps a phone's curl smooth: a frame moves what was drawn, and draws nothing anew. A clip,
  // a gradient or a size changed each frame was drawn again each frame, and the curl stuttered.
  it('changes only transforms from one frame to the next as the hand moves', () => {
    const to = sheet();
    const view = new CurlView(pageCopy(to, '.words'), to, 1, '.words');
    view.draw(curlFrame(page, [400, 500], [380, 490], lengths));
    // Each element's style but its transform: a frame may move things, and do nothing else.
    const unmoved = (style: string | null | undefined) =>
      (style ?? '').replace(/(^|;)\s*transform:[^;]*/g, '$1').trim();
    const styles = () =>
      [view.element, ...view.element.querySelectorAll('*')].map((element) =>
        unmoved(element.getAttribute('style')),
      );
    const drawn = styles();
    const changed: string[] = [];
    const watch = new MutationObserver((records) => {
      for (const record of records) {
        const element = record.target as HTMLElement;
        if (unmoved(record.oldValue) !== unmoved(element.getAttribute('style')))
          changed.push(element.className);
      }
    });
    watch.observe(view.element, { attributes: true, attributeOldValue: true, subtree: true });
    for (const x of [300, 150, 0, -200, -380])
      view.draw(curlFrame(page, [400, 500], [x, 470], lengths));
    watch.disconnect();
    expect(changed).toEqual([]);
    expect(styles()).toEqual(drawn);
  });

  it('at rest, shows the page flat and nothing else', () => {
    const to = sheet();
    const view = new CurlView(pageCopy(to, '.words'), to, 1, '.words');
    view.draw(curlFrame(page, [400, 500], [400, 500], lengths));
    const flap = view.element.querySelector<HTMLElement>('.turn-curl__flap');
    expect(flap?.style.visibility).toBe('hidden');
    const strips = [...view.element.querySelectorAll<HTMLElement>('.turn-curl__strip')];
    expect(strips.map((strip) => strip.style.visibility)).toEqual(strips.map(() => 'hidden'));
    expect(view.element.querySelector<HTMLElement>('.turn-curl__front')?.style.transform).toMatch(
      /^matrix\(/,
    );
  });

  it('stacks its pieces in order, whatever the page’s own rules would', () => {
    const to = sheet();
    const view = new CurlView(pageCopy(to, '.words'), to, -1, '.words');
    const order = [...view.element.children].map((child) => (child as HTMLElement).style.zIndex);
    expect(order[0]).toBe('0');
    expect(order.slice(1)).toEqual(order.slice(1).map((_, i) => String(i + 1)));
    view.remove();
    expect(view.element.isConnected).toBe(false);
    expect(to.style.visibility).toBe('');
  });
});

describe('its CSS', () => {
  it('wears a ramp as the ink at each edge’s strength across the middle third, never a colour of its own', () => {
    expect(rampOf('var(--eien-curl-shade)', [0, 1])).toBe(
      'linear-gradient(90deg, color-mix(in srgb, var(--eien-curl-shade) 0.0%, transparent) 33.333%, color-mix(in srgb, var(--eien-curl-shade) 100.0%, transparent) 66.667%)',
    );
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
