// A Mac trackpad's two fingers swiped back across the window (#70).

import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { swipeBack } from './swipe-back';

let back: Mock<() => void>;
let stop: () => void;
let page: HTMLElement;

beforeEach(() => {
  back = vi.fn<() => void>();
  page = document.createElement('div');
  document.body.append(page);
  stop = swipeBack(window, back);
});
afterEach(() => {
  stop();
  document.body.replaceChildren();
});

/** Two fingers across `over`, a wheel event a step, `dx` each, as a trackpad sends them. */
const across = (dx: number, over: Element = page, init: WheelEventInit = {}) => {
  for (let step = 0; step < 12; step += 1) {
    const event = new WheelEvent('wheel', {
      bubbles: true,
      deltaX: dx,
      deltaY: 0,
      deltaMode: 0,
      ...init,
    });
    // happy-dom's WheelEvent leaves out the keys held.
    Object.defineProperty(event, 'ctrlKey', { value: init.ctrlKey ?? false });
    over.dispatchEvent(event);
  }
};

describe('two fingers swiped back across the window', () => {
  it('go back when the page is pulled to the right, once for the swipe', () => {
    across(-20);
    expect(back).toHaveBeenCalledOnce();
  });

  it('never go back the other way', () => {
    across(20);
    expect(back).not.toHaveBeenCalled();
  });

  it('never for a pinch', () => {
    across(-20, page, { ctrlKey: true });
    expect(back).not.toHaveBeenCalled();
  });

  it('never for a mouse’s wheel by lines', () => {
    across(-20, page, { deltaMode: 1 });
    expect(back).not.toHaveBeenCalled();
  });

  it('never over what scrolls sideways itself (a wide table)', () => {
    const wide = document.createElement('div');
    wide.style.overflowX = 'auto';
    Object.defineProperty(wide, 'scrollWidth', { value: 900 });
    Object.defineProperty(wide, 'clientWidth', { value: 300 });
    page.append(wide);
    across(-20, wide);
    expect(back).not.toHaveBeenCalled();
  });

  it('stop listening when stopped', () => {
    stop();
    across(-20);
    expect(back).not.toHaveBeenCalled();
  });
});
