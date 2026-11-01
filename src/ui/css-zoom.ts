// The page's zoom (`zoom` on the sheet, Page zoom) as it draws an element:
// what's measured (a rect) is zoomed, what's placed (a size, a translate)
// isn't, so a place measured is divided by it. The window's own figure where
// it gives one: a ratio of a rect to a size rounds both, and its error grows
// with the distance it divides (#40: a book's fifteenth page opened a page early).

/** How much the zoom on `element` and above it draws each of its pixels as. */
export function zoomOf(element: HTMLElement): number {
  const exact = (element as HTMLElement & { currentCSSZoom?: number }).currentCSSZoom;
  if (exact !== undefined) return exact;
  // A window without it (an older WebView) measures: a rect against the size it draws.
  const size = element.clientWidth;
  return size > 0 ? element.getBoundingClientRect().width / size || 1 : 1;
}
