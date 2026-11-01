// Whether a gesture over an element is its own: it, or a box it lies in,
// scrolls sideways now (a wide table, a long line of code). A trackpad's
// swipe back (./swipe-back.ts) and a finger's chapter swipe in a book
// (../epub/chapter-swipe.ts) leave such a box its sideways scroll.

/** Whether `from` or a box it lies in scrolls sideways now. */
export function scrollsAcross(from: EventTarget | null): boolean {
  for (let at = from instanceof Element ? from : null; at; at = at.parentElement) {
    if (at.scrollWidth <= at.clientWidth) continue;
    const { overflowX } = getComputedStyle(at);
    if (overflowX === 'auto' || overflowX === 'scroll') return true;
  }
  return false;
}
