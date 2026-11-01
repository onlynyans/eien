// A turn's copy of the page (./page-copy.ts): made from the sheet, kept to
// the words round the sight, and laid over the sheet where the window draws
// it. happy-dom lays nothing out, so where a test needs a box it says where.

import { afterEach, describe, expect, it } from 'vitest';
import { layOver, pageCopy, WORDS } from './page-copy';

function sheetOf(html: string): HTMLElement {
  const host = document.createElement('div');
  const sheet = document.createElement('article');
  sheet.innerHTML = html;
  host.append(sheet);
  document.body.append(host);
  return sheet;
}

afterEach(() => document.body.replaceChildren());

describe('a turn’s copy of the page', () => {
  it('keeps nothing found by name in the words the trim puts in', () => {
    const sheet = sheetOf('<div class="words"><p>Page</p></div>');
    // The trim's words are the book's own again, laid as the page lays them: its anchors and ids too.
    const copy = pageCopy(sheet, '.words', (words) => {
      words.innerHTML =
        '<p id="n1" data-anchor="n1"><a href="#n2" tabindex="0" aria-describedby="n2">One</a></p>';
      return true;
    });
    expect(copy?.querySelector('[id], [data-anchor], [tabindex], [aria-describedby]')).toBeNull();
    expect(copy?.textContent).toBe('One');
    expect(copy?.querySelector('.words')?.hasAttribute(WORDS)).toBe(true);
  });

  it('is none where the trim has none to give', () => {
    const sheet = sheetOf('<div class="words"><p>Page</p></div>');
    expect(pageCopy(sheet, '.words', () => false)).toBeNull();
    expect(pageCopy(sheet, '.words', () => true)).not.toBeNull();
  });
});

describe('a copy laid over the sheet', () => {
  /**
   * The sheet 10px across and 20px down in its parent, which stands at
   * (100, 200): under Page zoom it's drawn at a part of a pixel, which
   * offsets, whole pixels, can't say. The copy's box follows its own style.
   */
  function laid(rect: { left: number; top: number; width: number; height: number }, zoom = 1) {
    const sheet = sheetOf('<p>Page</p>');
    for (const [name, value] of [
      ['offsetLeft', 10],
      ['offsetTop', 20],
      ['offsetWidth', 400],
      ['offsetHeight', 600],
    ] as const) {
      Object.defineProperty(sheet, name, { value, configurable: true });
    }
    sheet.getBoundingClientRect = () => rect as DOMRect;
    const copy = document.createElement('article');
    Object.defineProperty(copy, 'currentCSSZoom', { value: zoom });
    copy.getBoundingClientRect = () =>
      ({
        left: 100 + zoom * Number.parseFloat(copy.style.left),
        top: 200 + zoom * Number.parseFloat(copy.style.top),
        width: zoom * Number.parseFloat(copy.style.width),
        height: zoom * Number.parseFloat(copy.style.height),
      }) as DOMRect;
    layOver(copy, sheet);
    const px = (length: string) => Number.parseFloat(length);
    return {
      copy,
      sheet,
      box: {
        left: px(copy.style.left),
        top: px(copy.style.top),
        width: px(copy.style.width),
        height: px(copy.style.height),
      },
    };
  }

  it('stands where the sheet is drawn, to the part of a pixel, and as large', () => {
    const { copy, sheet, box } = laid({ left: 110.4, top: 220.6, width: 400.5, height: 600.25 });
    expect(sheet.nextElementSibling).toBe(copy);
    expect(box.left).toBeCloseTo(10.4, 6);
    expect(box.top).toBeCloseTo(20.6, 6);
    expect(box.width).toBeCloseTo(400.5, 6);
    expect(box.height).toBeCloseTo(600.25, 6);
  });

  it('under Page zoom, places itself in its own pixels, not the rect’s', () => {
    const { box } = laid({ left: 120.8, top: 241.2, width: 801, height: 1200.5 }, 2);
    expect(box.left).toBeCloseTo(10.4, 6);
    expect(box.top).toBeCloseTo(20.6, 6);
    expect(box.width).toBeCloseTo(400.5, 6);
    expect(box.height).toBeCloseTo(600.25, 6);
  });

  it('keeps the sheet’s offsets where the sheet isn’t laid out', () => {
    const { box } = laid({ left: 0, top: 0, width: 0, height: 0 });
    expect(box).toEqual({ left: 10, top: 20, width: 400, height: 600 });
  });
});
