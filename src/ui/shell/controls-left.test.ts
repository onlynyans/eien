// The window's top-left corner knows whether macOS's traffic lights are in it:
// in a window, yes; in full screen, and on Windows and Linux (controls at the
// right), no. And the bands know how wide the system's controls stand, as the
// overlay last told, whatever the window's width does between (#44).

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

/** The window's width, as a resize leaves it. */
const resize = (width: number) =>
  Object.defineProperty(window, 'innerWidth', { value: width, configurable: true });

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

  it('keeps the bands clear by the controls’ width, measured until a resize', () => {
    resize(1200);
    const overlay = fakeOverlay(true, 0, 138); // Windows' or Linux's, at the right
    const stop = followControlsLeft();
    expect(width()).toBe('138px');
    // Told in the middle of a resize, the area a step behind the window's width (Linux) or
    // ahead of it (a Mac): the width holds.
    resize(1400);
    overlay.controls = 338;
    overlay.dispatchEvent(new Event('geometrychange'));
    expect(width()).toBe('138px');
    overlay.controls = -62;
    overlay.dispatchEvent(new Event('geometrychange'));
    expect(width()).toBe('138px');
    // A taller band (a zoom), or full screen and back: measured again.
    overlay.controls = 150;
    overlay.height = 48;
    overlay.dispatchEvent(new Event('geometrychange'));
    expect(width()).toBe('150px');
    overlay.visible = false;
    overlay.dispatchEvent(new Event('geometrychange'));
    expect(width()).toBe('0px');
    overlay.visible = true;
    overlay.dispatchEvent(new Event('geometrychange'));
    expect(width()).toBe('150px');
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
