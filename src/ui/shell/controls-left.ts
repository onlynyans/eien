// Whether the system's controls stand in the window's top-left corner:
// macOS's traffic lights, in a window but not in full screen, which has none
// (spec §4). The window controls overlay says, and tells again as the window
// goes full screen and back. `data-controls-left` on <html> puts the width the
// controls take (--controls-w, ./shell.css) at the window's left edge, and is
// what the corner's styles follow (../sidebar/sidebar.css, ../chrome/band.css).

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
  const tell = () =>
    root.toggleAttribute(
      'data-controls-left',
      overlay.visible && overlay.getTitlebarAreaRect().x > 0,
    );
  overlay.addEventListener('geometrychange', tell);
  tell();
  return () => overlay.removeEventListener('geometrychange', tell);
}
