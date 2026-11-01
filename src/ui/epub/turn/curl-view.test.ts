import { afterEach, describe, expect, it, vi } from 'vitest';
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
  vi.restoreAllMocks();
});

describe('the curl drawn', () => {
  it('lays the page as its bands: what stays, twelve strips, what lies back, each moved, none clipped', () => {
    const to = sheet();
    const view = new CurlView(pageCopy(to, '.words'), to, 1, null);
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
  it('changes only transforms, and the shadows’ strength, from one frame to the next as the hand moves', () => {
    const to = sheet();
    const view = new CurlView(pageCopy(to, '.words'), to, 1, null);
    view.draw(curlFrame(page, [400, 500], [380, 490], lengths));
    // Each element's style but its transform and opacity: a frame may move things and fade the
    // shadows (the compositor's alone), and do nothing else.
    const unmoved = (style: string | null | undefined) =>
      (style ?? '').replace(/(^|;)\s*(transform|opacity):[^;]*/g, '$1').trim();
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

  // Only the shadows fade: the paper itself is never seen through.
  it('fades only the shadows, as the paper is high: none just taken, whole half over', () => {
    const to = sheet();
    const view = new CurlView(pageCopy(to, '.words'), to, 1, null);
    const strength = () =>
      [...view.element.querySelectorAll<HTMLElement>('[style*="opacity"]')].map((element) => [
        element.classList[1],
        Number(element.style.opacity),
      ]);
    view.draw(curlFrame(page, [400, 500], [399, 500], lengths));
    for (const [, opacity] of strength()) expect(opacity).toBeLessThan(0.02);
    view.draw(curlFrame(page, [400, 500], [0, 500], lengths));
    expect(strength()).toEqual([
      ['turn-curl__cast', 1],
      ['turn-curl__shadow', 1],
    ]);
  });

  // The lifted paper's shadow is round what lies back on top: laid exactly as it is.
  it('lays the lifted paper’s shadow as what lies back, past the page', () => {
    const to = sheet();
    const view = new CurlView(pageCopy(to, '.words'), to, 1, null);
    view.draw(curlFrame(page, [400, 500], [100, 450], lengths));
    const laid = (name: string) => {
      const band = view.element.querySelector<HTMLElement>(`.turn-curl__${name}`);
      const inside = band?.querySelector<HTMLElement>('.turn-curl__inside');
      return [band?.style.transform, inside?.style.transform];
    };
    expect(laid('shadow')).toEqual(laid('back'));
    const inside = view.element.querySelector('.turn-curl__shadow .turn-curl__inside');
    expect(inside?.classList.contains('turn-curl__inside--uncut')).toBe(true);
  });

  it('at rest, shows the page flat and nothing else', () => {
    const to = sheet();
    const view = new CurlView(pageCopy(to, '.words'), to, 1, null);
    view.draw(curlFrame(page, [400, 500], [400, 500], lengths));
    const flap = view.element.querySelector<HTMLElement>('.turn-curl__flap');
    expect(flap?.style.visibility).toBe('hidden');
    const strips = [...view.element.querySelectorAll<HTMLElement>('.turn-curl__strip')];
    expect(strips.map((strip) => strip.style.visibility)).toEqual(strips.map(() => 'hidden'));
    expect(view.element.querySelector<HTMLElement>('.turn-curl__front')?.style.transform).toMatch(
      /^matrix\(/,
    );
  });

  // A hand that brings the corner home and takes it again: the roll and its shadow go as it lands
  // flat, and come back with the next pull.
  it('hides the roll again when the page comes to rest, and shows it as it lifts again', () => {
    const to = sheet();
    const view = new CurlView(pageCopy(to, '.words'), to, 1, null);
    const flap = () =>
      view.element.querySelector<HTMLElement>('.turn-curl__flap')?.style.visibility;
    const hidden = () =>
      [...view.element.querySelectorAll<HTMLElement>('.turn-curl__cast, .turn-curl__strip')].filter(
        (band) => band.style.visibility === 'hidden',
      ).length;
    view.draw(curlFrame(page, [400, 500], [150, 470], lengths));
    expect([flap(), hidden()]).toEqual(['', 0]);
    view.draw(curlFrame(page, [400, 500], [400, 500], lengths));
    expect([flap(), hidden()]).toEqual(['hidden', 1 + CURL_STRIPS]);
    view.draw(curlFrame(page, [400, 500], [150, 470], lengths));
    expect([flap(), hidden()]).toEqual(['', 0]);
  });

  // The curl clips itself (its bands reach far past the page) where the pane round the sheet cuts,
  // so a flap pulled off the sheet still shows on the blotter. Its margin is in its own pixels:
  // measured on the screen, divided by the page's zoom it wears.
  it('cuts as far past the sheet as the pane reaches, in its own zoomed pixels', () => {
    const pane = document.createElement('div');
    document.body.append(pane);
    const to = document.createElement('article');
    to.innerHTML = '<p class="words">Words</p>';
    pane.append(to);
    const rect = (left: number, top: number, right: number, bottom: number) =>
      ({
        left,
        top,
        right,
        bottom,
        x: left,
        y: top,
        width: right - left,
        height: bottom - top,
      }) as DOMRect;
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement,
    ) {
      if (this === pane) return rect(100, 40, 1300, 900);
      if (this.classList.contains('turn-curl')) return rect(400, 70, 1000, 870);
      return rect(0, 0, 0, 0);
    });
    Object.defineProperty(HTMLElement.prototype, 'currentCSSZoom', {
      configurable: true,
      get(this: HTMLElement) {
        return this.classList.contains('turn-curl') ? 1.5 : 1;
      },
    });
    try {
      const view = new CurlView(pageCopy(to, '.words'), to, 1, null);
      expect(view.element.parentElement).toBe(pane);
      // 300 px to the pane's left and right, the most it reaches: 200 of the curl's own.
      expect(view.element.style.overflowClipMargin).toBe('200px');
    } finally {
      delete (HTMLElement.prototype as { currentCSSZoom?: number }).currentCSSZoom;
    }
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
  it('wears a ramp as the ink at each edge’s strength, never a colour of its own', () => {
    expect(rampOf('var(--eien-curl-shade)', [0, 1])).toBe(
      'linear-gradient(90deg, color-mix(in srgb, var(--eien-curl-shade) 0.0%, transparent), color-mix(in srgb, var(--eien-curl-shade) 100.0%, transparent))',
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
