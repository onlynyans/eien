// Where the system's controls stand, and how wide: macOS's traffic lights in
// the window's top-left corner (in a window but not in full screen, which has
// none), or Windows' and Linux's at the right (spec §4). The window controls
// overlay says, and tells again as the window resizes, goes full screen and
// back. `data-controls-left` on <html> is what the corner's styles follow
// (../sidebar/sidebar.css, ../chrome/band.css), and `--controls-w` how far the
// bands keep clear of the controls (./shell.css).
//
// The width is measured once the window holds still: the same two frames
// running, with no resize or word from the overlay between (#44). Measured in
// the middle of a resize it's off by the whole step, either way: on Linux the
// overlay's area reaches the page a frame after the window's new width, on a
// Mac a frame before it; and at each step on a Mac AppKit puts the lights back
// at its own spot for a frame, so the area's x moves 13px (x is only read for
// which edge). Held still, the controls' width never changes with a resize.

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
  /** Measure again once the window holds still; a resize or the overlay's word starts over. */
  const settle = () => {
    cancelAnimationFrame(frame);
    let last: number | null = null;
    const look = () => {
      const now = widthNow();
      if (now === last) write(now);
      else {
        last = now;
        frame = requestAnimationFrame(look);
      }
    };
    frame = requestAnimationFrame(look);
  };
  const tell = () => {
    const area = overlay.getTitlebarAreaRect();
    root.toggleAttribute('data-controls-left', overlay.visible && area.width > 0 && area.x > 0);
    settle();
  };
  overlay.addEventListener('geometrychange', tell);
  addEventListener('resize', settle);
  tell();
  write(widthNow()); // the window still as it opens
  return () => {
    cancelAnimationFrame(frame);
    overlay.removeEventListener('geometrychange', tell);
    removeEventListener('resize', settle);
  };
}
