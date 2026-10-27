// Where the system's controls stand, and how wide: macOS's traffic lights in
// the window's top-left corner (in a window but not in full screen, which has
// none), or Windows' and Linux's at the right (spec §4). The window controls
// overlay says, and tells again as the window resizes, goes full screen and
// back. `data-controls-left` on <html> is what the corner's styles follow
// (../sidebar/sidebar.css, ../chrome/band.css), and `--controls-w` how far the
// bands keep clear of the controls (./shell.css).
//
// The width is measured once the window holds still, and the overlay has
// caught up with it: a resize and the overlay's word since the last time, then
// the same two frames running with neither between (#44). Measured in the
// middle of a resize it's off by the whole step, either way: on Linux the
// overlay's area reaches the page frames after the window's new width, on a
// Mac a frame before it; and at each step on a Mac AppKit puts the lights back
// at its own spot for a frame, so the area's x moves 13px (x is only read for
// which edge). A page sized without the window (a test's viewport) hears no
// word from the overlay, and keeps the window's width.

/** The window controls overlay's API, which TypeScript's DOM types don't have yet. */
interface ControlsOverlay extends EventTarget {
  readonly visible: boolean;
  getTitlebarAreaRect(): DOMRect;
}

/** Follow the overlay; returns a function that stops. A phone, or a browser, has none. */
export function followControlsLeft(root: HTMLElement = document.documentElement): () => void {
  const overlay = (navigator as Navigator & { windowControlsOverlay?: ControlsOverlay })
    .windowControlsOverlay;
  if (!overlay) return () => {};
  const widthNow = () => {
    const area = overlay.getTitlebarAreaRect();
    return overlay.visible && area.width > 0 ? Math.max(0, innerWidth - area.width) : 0;
  };
  // Through the style API: the security policy refuses style attributes.
  const write = (width: number) => root.style.setProperty('--controls-w', `${width}px`);
  let frame = 0;
  /** Since the last measure: whether the window was resized, and whether the overlay told. */
  let resized = false;
  let told = false;
  /** Measure again once both have come and the window holds still; either starts over. */
  const settle = () => {
    cancelAnimationFrame(frame);
    if (!resized || !told) return;
    let last: number | null = null;
    const look = () => {
      const now = widthNow();
      if (now === last) {
        write(now);
        resized = told = false;
      } else {
        last = now;
        frame = requestAnimationFrame(look);
      }
    };
    frame = requestAnimationFrame(look);
  };
  const tell = () => {
    const area = overlay.getTitlebarAreaRect();
    root.toggleAttribute('data-controls-left', overlay.visible && area.width > 0 && area.x > 0);
    told = true;
    settle();
  };
  const onResize = () => {
    resized = true;
    settle();
  };
  overlay.addEventListener('geometrychange', tell);
  addEventListener('resize', onResize);
  tell();
  write(widthNow()); // the window still as it opens
  told = false;
  return () => {
    cancelAnimationFrame(frame);
    overlay.removeEventListener('geometrychange', tell);
    removeEventListener('resize', onResize);
  };
}
