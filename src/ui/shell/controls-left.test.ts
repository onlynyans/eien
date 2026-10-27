// The window's top-left corner knows whether macOS's traffic lights are in it:
// in a window, yes; in full screen, and on Windows and Linux (controls at the
// right), no. And the bands know how wide the system's controls stand,
// measured once the window holds still, never in the middle of a resize (#44).

import { afterEach, describe, expect, it } from 'vitest';
import { followControlsLeft } from './controls-left';

/**
 * A window controls overlay the test moves: visible or not, its free area
 * starting at `x` and as wide as the window less `controls`.
 */
function fakeOverlay(visible: boolean, x: number, controls = 94) {
  const overlay = Object.assign(new EventTarget(), {
    visible,
    x,
    controls,
    height: 40,
    getTitlebarAreaRect: () =>
      overlay.visible
        ? new DOMRect(overlay.x, 0, innerWidth - overlay.controls, overlay.height)
        : new DOMRect(0, 0, 0, 0),
  });
  Object.defineProperty(navigator, 'windowControlsOverlay', {
    value: overlay,
    configurable: true,
  });
  return overlay;
}

/** The page's width, as a resize leaves it; the window's too, unless `page` alone (a zoom). */
const resize = (width: number, page = false) => {
  Object.defineProperty(window, 'innerWidth', { value: width, configurable: true });
  if (!page) Object.defineProperty(window, 'outerWidth', { value: width, configurable: true });
};

afterEach(() => {
  Reflect.deleteProperty(navigator, 'windowControlsOverlay');
  resize(1024); // happy-dom's own
  document.documentElement.removeAttribute('data-controls-left');
  document.documentElement.style.removeProperty('--controls-w');
});

describe('followControlsLeft', () => {
  const root = document.documentElement;

  it('marks the corner while the lights are there, and not once the window is full screen', () => {
    const overlay = fakeOverlay(true, 94);
    const stop = followControlsLeft();
    expect(root.hasAttribute('data-controls-left')).toBe(true);
    overlay.visible = false; // full screen: no lights, no overlay
    overlay.dispatchEvent(new Event('geometrychange'));
    expect(root.hasAttribute('data-controls-left')).toBe(false);
    overlay.visible = true;
    overlay.dispatchEvent(new Event('geometrychange'));
    expect(root.hasAttribute('data-controls-left')).toBe(true);
    stop();
  });

  it('leaves the corner unmarked with no overlay (a phone), or the controls at the right', () => {
    followControlsLeft()();
    expect(root.hasAttribute('data-controls-left')).toBe(false);
    fakeOverlay(true, 0);
    followControlsLeft()();
    expect(root.hasAttribute('data-controls-left')).toBe(false);
  });

  const width = () => root.style.getPropertyValue('--controls-w');

  /** The next `count` frames drawn. */
  const frames = (count: number) =>
    new Promise<void>((done) => {
      const next = (left: number) =>
        left === 0 ? done() : requestAnimationFrame(() => next(left - 1));
      next(count);
    });

  it('keeps the bands clear by the controls’ width, held through a resize', async () => {
    resize(1200);
    const overlay = fakeOverlay(true, 0, 138); // Windows' or Linux's, at the right
    const stop = followControlsLeft();
    expect(width()).toBe('138px');
    // Each step of a resize told with the area a step behind the window's width (Linux) or
    // ahead of it (a Mac): the width holds, each frame, as long as the resize goes on.
    for (const [step, off] of [
      [1240, 40],
      [1280, -40],
      [1320, 40],
    ] as const) {
      resize(step);
      dispatchEvent(new Event('resize'));
      overlay.controls = 138 + off;
      overlay.dispatchEvent(new Event('geometrychange'));
      expect(width()).toBe('138px');
      await frames(1);
      expect(width()).toBe('138px');
    }
    // Held still, the overlay caught up: measured again, the same width.
    overlay.controls = 138;
    overlay.dispatchEvent(new Event('geometrychange'));
    await frames(4);
    expect(width()).toBe('138px');
    stop();
  });

  it('waits for the overlay to catch up, however many frames it takes (Linux)', async () => {
    resize(1200);
    const overlay = fakeOverlay(true, 0, 138);
    const stop = followControlsLeft();
    resize(1240);
    overlay.controls = 178; // the area still the narrower window's
    dispatchEvent(new Event('resize'));
    await frames(6);
    expect(width()).toBe('138px');
    overlay.controls = 138; // caught up, and says so
    overlay.dispatchEvent(new Event('geometrychange'));
    await frames(4);
    expect(width()).toBe('138px');
    stop();
  });

  it('measures a page sized without the window as it is (a test’s viewport)', async () => {
    resize(1200);
    const overlay = fakeOverlay(true, 0, 138);
    const stop = followControlsLeft();
    resize(1600, true);
    overlay.controls = 538; // the area the window's, the page's width not
    dispatchEvent(new Event('resize'));
    await frames(4);
    expect(width()).toBe('538px');
    stop();
  });

  it('measures again once still, after a zoom or full screen', async () => {
    resize(1200);
    const overlay = fakeOverlay(true, 0, 138);
    const stop = followControlsLeft();
    // A zoom: the page narrower in its own pixels, the controls wider in them.
    resize(1000, true);
    overlay.controls = 150;
    dispatchEvent(new Event('resize'));
    overlay.dispatchEvent(new Event('geometrychange'));
    expect(width()).toBe('138px');
    await frames(4);
    expect(width()).toBe('150px');
    resize(1440); // full screen: no controls
    overlay.visible = false;
    overlay.dispatchEvent(new Event('geometrychange'));
    dispatchEvent(new Event('resize'));
    await frames(4);
    expect(width()).toBe('0px');
    stop();
  });

  it('takes the lights’ width from the area’s width, not from where the area starts', () => {
    resize(1200);
    fakeOverlay(true, 81); // a Mac's resize: the lights at AppKit's spot
    const stop = followControlsLeft();
    expect(width()).toBe('94px');
    expect(root.hasAttribute('data-controls-left')).toBe(true);
    stop();
  });

  it('has the controls take no room with no overlay (a phone)', () => {
    followControlsLeft()();
    expect(width()).toBe('');
  });

  it('stops following when asked', () => {
    const overlay = fakeOverlay(true, 94);
    followControlsLeft()();
    overlay.visible = false;
    overlay.dispatchEvent(new Event('geometrychange'));
    expect(root.hasAttribute('data-controls-left')).toBe(true);
  });
});
