import { describe, expect, it } from 'vitest';
import { zoomOf } from './css-zoom';

/** A box 249px wide drawn at 150%: 373.5px, which a rect rounds to 374. */
function box(currentCSSZoom?: number): HTMLElement {
  const element = document.createElement('div');
  Object.defineProperty(element, 'clientWidth', { value: 249 });
  element.getBoundingClientRect = () => ({ width: 374 }) as DOMRect;
  if (currentCSSZoom !== undefined)
    Object.defineProperty(element, 'currentCSSZoom', { value: currentCSSZoom });
  return element;
}

describe('zoomOf', () => {
  it('is the window’s own figure where it gives one, not a rounded rect against a size', () => {
    expect(zoomOf(box(1.5))).toBe(1.5);
  });

  it('measures where the window gives none', () => {
    expect(zoomOf(box())).toBeCloseTo(374 / 249);
  });

  it('is 1 for a box not laid out', () => {
    const element = document.createElement('div');
    expect(zoomOf(element)).toBe(1);
  });
});
