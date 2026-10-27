// The whole interface's zoom on a phone (spec §6, Interface zoom): the page's
// viewport scaled, as a browser zooms, so everything is laid out again at the
// width the zoom leaves (a Fold 5 sideways at 80% lays out at about 880px,
// not 706): every measure, media query and Wide screen room follows it, and
// no element has rules of its own. The desktop's is Electron's, on the window
// (../../app/electron/frame.ts), which a page's viewport doesn't touch. On
// Android the WebView reads the viewport as a browser does only with its wide
// viewport on (android/.../MainActivity.java); both checked there and in
// Chromium (tests/android/phone.spec.ts, tests/mobile/phone-zoom.spec.ts).

/**
 * The viewport for `zoom` (a percentage) on a screen `screenWidth` wide. A zoom out lays the page
 * out at the screen's width over the scale by itself; a zoom in needs that width spelt out, as
 * `device-width` would keep the screen's and run past it. Never smaller than chosen: a phone's
 * browser would zoom out to show what's too wide.
 */
export const viewportFor = (zoom: number, screenWidth: number): string => {
  const scale = zoom / 100;
  const width = zoom <= 100 ? 'device-width' : String(Math.round(screenWidth / scale));
  return `width=${width}, initial-scale=${scale}, minimum-scale=${scale}, viewport-fit=cover`;
};

/**
 * Scale the page's viewport to `zoom`; written only when it changes, as a write lays out again.
 * The page starts as `viewportFor(100, …)` writes it (../index.html).
 */
export function fitViewport(zoom: number, doc: Document = document): void {
  const meta = doc.querySelector('meta[name="viewport"]');
  const content = viewportFor(zoom, doc.defaultView?.screen.width ?? 0);
  if (meta && meta.getAttribute('content') !== content) meta.setAttribute('content', content);
}

/**
 * Keep the viewport at `zoom()` as the screen turns or unfolds (a zoom in's width is the
 * screen's); returns a function to stop. Its own writes resize the page too, and change nothing.
 */
export function followViewport(zoom: () => number, win: Window = window): () => void {
  const refit = () => fitViewport(zoom(), win.document);
  refit();
  win.addEventListener('resize', refit);
  return () => win.removeEventListener('resize', refit);
}
