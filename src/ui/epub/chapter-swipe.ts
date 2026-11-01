// A finger swiped across a book's page in Scroll turns the chapter (#71), as
// Pages' turns go on into the next: leftward the next, rightward the one
// before. Read from touch events, which keep coming through the browser's
// own scroll, and decided as the finger lifts: far enough across (a quarter
// of the page), more across than down, and the page never scrolled under
// it, so a scroll drifting sideways is a scroll. Never with words chosen (a
// long press chose them), two fingers, the page pinched larger, or over
// what scrolls sideways itself; never what the system takes at the screen's
// edge for its back, which cancels the touch. In pages a finger is the
// turn's own (./turn/hand-events.ts).

import type { Way } from '../../core/epub';
import { scrollsAcross } from '../shell/scrolls-across';
import { chosenIn } from './turn/hand-events';
import { acrossOf } from './turn/turn-hand';

/** How far across a swipe goes to turn the chapter: this share of the page's width. */
export const SWIPE_ACROSS = 1 / 4;

export interface ChapterSwipeOf {
  /** Where fingers are taken: the page's scroller. */
  readonly target: HTMLElement;
  /** The sheet in sight, measured as the window shows it (zoomed). */
  sheet(): HTMLElement | null;
  /** Whether the chapter is in pages now: then not. */
  paged(): boolean;
  /** The chapter turned `way`. */
  turn(way: Way): void;
}

interface Held {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly top: number;
}

/**
 * Whether the window is pinched larger than its page: a finger then moves the view. By the view's
 * width against the page's, never its scale, which a phone's Interface zoom sets (../settings/viewport.ts).
 */
const pinched = () =>
  (window.visualViewport?.width ?? Number.POSITIVE_INFINITY) <
  document.documentElement.clientWidth - 1;

/** Fingers across `of.target` turning the chapter; the returned function stops them. */
export function chapterSwipe(of: ChapterSwipeOf): () => void {
  let held: Held | null = null;

  const start = (event: TouchEvent) => {
    held = null;
    const sheet = of.sheet();
    const touch = event.touches[0];
    if (event.touches.length !== 1 || !touch || !sheet || of.paged()) return;
    if (chosenIn(sheet) || pinched() || scrollsAcross(event.target)) return;
    held = { id: touch.identifier, x: touch.clientX, y: touch.clientY, top: of.target.scrollTop };
  };

  const move = (event: TouchEvent) => {
    if (event.touches.length !== 1) held = null;
  };

  const end = (event: TouchEvent) => {
    const was = held;
    held = null;
    const touch = was && [...event.changedTouches].find((each) => each.identifier === was.id);
    const sheet = of.sheet();
    if (!was || !touch || !sheet || of.paged() || chosenIn(sheet)) return;
    if (Math.abs(of.target.scrollTop - was.top) > 1) return;
    const min = sheet.getBoundingClientRect().width * SWIPE_ACROSS;
    const way = acrossOf([touch.clientX - was.x, touch.clientY - was.y], Math.max(min, 1));
    if (way) of.turn(way);
  };

  const cancel = () => {
    held = null;
  };

  const listening: [string, EventListener][] = [
    ['touchstart', start as EventListener],
    ['touchmove', move as EventListener],
    ['touchend', end as EventListener],
    ['touchcancel', cancel],
  ];
  for (const [type, listener] of listening)
    of.target.addEventListener(type, listener, { passive: true });
  return () => {
    for (const [type, listener] of listening) of.target.removeEventListener(type, listener);
  };
}
