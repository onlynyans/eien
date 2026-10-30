// A hand on a page in pages (#40, Phase 3c): the pointer and the finger
// carried to the page turn (./page-turn.ts). A finger takes the page
// anywhere on it; a mouse takes it at the book's edges (a mouse's drag over
// the words chooses them, for Quote and Copy), or catches a page in flight
// anywhere on it. A drag across turns or falls back as the hand's speed
// decides; a drag that turned is never also a click on what it began on.
// Never while words are chosen, so a long press that chooses them keeps
// them.

import type { Point } from '../../../core/epub';
import type { PageTurn } from './page-turn';

export interface HandEventsOf {
  /** Where hands are taken: the page's pane. */
  readonly target: HTMLElement;
  /** The sheet in sight now, which a hand's place is measured on. */
  sheet(): HTMLElement | null;
  /** Whether the page is in pages now (in Scroll, a hand scrolls). */
  paged(): boolean;
  /** Where a mouse may take the page: the book's edges. */
  readonly edges: string;
}

interface Held {
  readonly id: number;
  readonly from: Point;
  /** The sheet's pixels to the window's: rects are zoomed, the page's own sizes aren't. */
  readonly scale: number;
}

/** The hand's events on `of.target` carried to `turn`; the returned function stops them. */
export function handEvents(turn: PageTurn, of: HandEventsOf): () => void {
  let held: Held | null = null;
  let swallow = false;

  const down = (event: PointerEvent) => {
    if (!of.paged() || event.button !== 0 || held) return;
    if (document.getSelection()?.isCollapsed === false) return;
    const sheet = of.sheet();
    const target = event.target instanceof Element ? event.target : null;
    if (!sheet || !target) return;
    const touch = event.pointerType !== 'mouse';
    const onEdge = target.closest(of.edges) !== null;
    const onSheet = sheet.contains(target);
    // A mouse over the words chooses them; it takes the page at its edges, or one in flight.
    if (!(onEdge || (onSheet && (touch || turn.turning)))) return;
    if (target.closest('a[href]') && !turn.turning) return;
    const box = sheet.getBoundingClientRect();
    const scale = sheet.offsetWidth > 0 ? box.width / sheet.offsetWidth || 1 : 1;
    held = { id: event.pointerId, from: [event.clientX, event.clientY], scale };
    turn.grab([(event.clientX - box.left) / scale, (event.clientY - box.top) / scale]);
  };

  const move = (event: PointerEvent) => {
    if (!held || event.pointerId !== held.id) return;
    const offset: Point = [
      (event.clientX - held.from[0]) / held.scale,
      (event.clientY - held.from[1]) / held.scale,
    ];
    turn.drag(offset, event.timeStamp);
    if (turn.turning && !of.target.hasPointerCapture(event.pointerId)) {
      // A pointer already gone can't be held: the window's own events still reach us.
      try {
        of.target.setPointerCapture(event.pointerId);
      } catch {}
    }
  };

  const up = (event: PointerEvent) => {
    if (!held || event.pointerId !== held.id) return;
    held = null;
    if (!turn.letGo()) return;
    swallow = true;
    setTimeout(() => {
      swallow = false;
    });
  };

  /** A drag that turned isn't also a click on the edge, link or page it began on. */
  const click = (event: MouseEvent) => {
    if (!swallow) return;
    event.stopPropagation();
    event.preventDefault();
  };

  of.target.addEventListener('pointerdown', down);
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);
  of.target.addEventListener('click', click, true);
  return () => {
    of.target.removeEventListener('pointerdown', down);
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', up);
    of.target.removeEventListener('click', click, true);
  };
}
