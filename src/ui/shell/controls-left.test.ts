// The window's top-left corner knows whether macOS's traffic lights are in it:
// in a window, yes; in full screen, and on Windows and Linux (controls at the
// right), no.

import { afterEach, describe, expect, it } from 'vitest';
import { followControlsLeft } from './controls-left';

/** A window controls overlay the test moves: visible or not, its free area starting at `x`. */
function fakeOverlay(visible: boolean, x: number) {
  const overlay = Object.assign(new EventTarget(), {
    visible,
    getTitlebarAreaRect: () => new DOMRect(overlay.visible ? x : 0, 0, 0, 0),
  });
  Object.defineProperty(navigator, 'windowControlsOverlay', {
    value: overlay,
    configurable: true,
  });
  return overlay;
}

afterEach(() => {
  Reflect.deleteProperty(navigator, 'windowControlsOverlay');
  document.documentElement.removeAttribute('data-controls-left');
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

  it('stops following when asked', () => {
    const overlay = fakeOverlay(true, 94);
    followControlsLeft()();
    overlay.visible = false;
    overlay.dispatchEvent(new Event('geometrychange'));
    expect(root.hasAttribute('data-controls-left')).toBe(true);
  });
});
