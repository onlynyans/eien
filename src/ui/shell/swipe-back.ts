// A Mac trackpad's two fingers swiped across the window, back (#70): the
// wheel events they come as read by core/swipe, anywhere in the window but
// over what scrolls sideways itself (a wide table), whose swipe is its own.
// Only where the system says two fingers swipe between pages
// (app/electron/swipe-session.ts); three fingers come by the bridge.

import { WheelSwipe } from '../../core/swipe/wheel-swipe';

/** Whether `from` or a box it lies in scrolls sideways now. */
export function scrollsAcross(from: EventTarget | null): boolean {
  for (let at = from instanceof Element ? from : null; at; at = at.parentElement) {
    if (at.scrollWidth <= at.clientWidth) continue;
    const { overflowX } = getComputedStyle(at);
    if (overflowX === 'auto' || overflowX === 'scroll') return true;
  }
  return false;
}

/** `back` on two fingers swiped back across `target`; the returned function stops it. */
export function swipeBack(target: EventTarget, back: () => void): () => void {
  const swipe = new WheelSwipe();
  const wheel = (event: WheelEvent) => {
    // A pinch is a wheel with Ctrl; a wheel by lines is a mouse's, never a trackpad's.
    if (event.ctrlKey || event.deltaMode !== WheelEvent.DOM_DELTA_PIXEL)
      return swipe.pass(event.timeStamp);
    if (scrollsAcross(event.target)) return swipe.pass(event.timeStamp);
    if (swipe.wheel(event.deltaX, event.deltaY, event.timeStamp) === 'back') back();
  };
  target.addEventListener('wheel', wheel as EventListener, { passive: true });
  return () => target.removeEventListener('wheel', wheel as EventListener);
}
