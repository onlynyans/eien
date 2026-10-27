// Where the system's controls stand, and how wide: macOS's traffic lights in
// the window's top-left corner (in a window but not in full screen, which has
// none), or Windows' and Linux's at the right (spec §4). The window controls
// overlay says, and tells again as the window resizes, goes full screen and
// back. `data-controls-left` on <html> is what the corner's styles follow
// (../sidebar/sidebar.css, ../chrome/band.css), and `--controls-w` how far the
// bands keep clear of the controls (./shell.css).
//
// The width is measured here, and only when what it depends on changes: the
// controls shown or not (full screen), the band's height, the zoom. A resize
// leaves it as it was (#44). Measured during one it can be off by the whole
// step, either way: on Linux the overlay's area reaches the page a frame after
// the window's new width, on a Mac a frame before it; and at each step on a Mac
// AppKit puts the lights back at its own spot for a frame, so the area's x moves
// 13px (x is only read for which edge).

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
  /** What the controls' width depends on, as last measured: none yet. */
  let measured: string | null = null;
  const tell = () => {
    const area = overlay.getTitlebarAreaRect();
    const shown = overlay.visible && area.width > 0;
    root.toggleAttribute('data-controls-left', shown && area.x > 0);
    const by = `${shown} ${area.height} ${devicePixelRatio}`;
    if (by === measured) return;
    measured = by;
    // Through the style API: the security policy refuses style attributes.
    root.style.setProperty('--controls-w', `${shown ? Math.max(0, innerWidth - area.width) : 0}px`);
  };
  overlay.addEventListener('geometrychange', tell);
  tell();
  return () => overlay.removeEventListener('geometrychange', tell);
}
