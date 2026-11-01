// A hand on a page in pages (#40, Phase 3c): the pointer and the finger
// carried to the page turn (./page-turn.ts). A finger takes the page
// anywhere on it; a mouse (or a pen) takes it at the book's edges (a drag
// over the words chooses them, for Quote and Copy), or catches a curl in
// flight anywhere on it. A drag across turns or falls back as the hand's
// speed decides; a cancelled gesture falls back. A drag that turned is never
// also a click on what it began on. Never while words are chosen in the
// page, so a long press that chooses them keeps them; and a finger held
// still is let go as the system's long press begins choosing (#65), so
// Pages chooses words by touch as Scroll does.

import type { Point } from '../../../core/epub';
import type { PageTurn } from './page-turn';
import { moved } from './turn-hand';

/** Whether words are chosen in `sheet`: a selection elsewhere (a note beside) never stops its hand. */
function chosenIn(sheet: HTMLElement): boolean {
  const selection = document.getSelection();
  return (
    selection !== null &&
    !selection.isCollapsed &&
    selection.anchorNode !== null &&
    sheet.contains(selection.anchorNode)
  );
}

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

/**
 * A drag's click comes this soon after it's let go, or never: a mouse's at
 * once, a finger's tap a little later (its gesture decided after the lift).
 */
const CLICK_AFTER_MS = 300;

interface Held {
  readonly id: number;
  readonly from: Point;
  /** The sheet's pixels to the window's: rects are zoomed, the page's own sizes aren't. */
  readonly scale: number;
  /** A finger's: held still, a long press is the system's, to choose words. */
  readonly touch: boolean;
  /** Moved past a tap (the drag's start): no longer a press the system may take. */
  moved: boolean;
}

/** The hand's events on `of.target` carried to `turn`; the returned function stops them. */
export function handEvents(turn: PageTurn, of: HandEventsOf): () => void {
  let held: Held | null = null;
  /** Until when (the event clock) a click is a drag's, not its own. */
  let swallowUntil = Number.NEGATIVE_INFINITY;

  /** The hand gone unasked: what it held falls back. */
  const lost = () => {
    held = null;
    if (turn.cancel()) swallowUntil = Number.NEGATIVE_INFINITY;
  };

  const down = (event: PointerEvent) => {
    if (!of.paged() || event.button !== 0) return;
    if (held) {
      // A second finger never takes the page from the first; a new first pointer means the old one
      // is gone without a word (the window lost it): what it held falls back.
      if (!event.isPrimary) return;
      lost();
    }
    const sheet = of.sheet();
    const target = event.target instanceof Element ? event.target : null;
    if (!sheet || !target || chosenIn(sheet)) return;
    const touch = event.pointerType === 'touch';
    const onEdge = target.closest(of.edges) !== null;
    const onSheet = sheet.contains(target);
    // A mouse over the words chooses them; it takes the page at its edges, or a curl in flight.
    if (!(onEdge || (onSheet && (touch || turn.catchable)))) return;
    if (target.closest('a[href]') && !turn.catchable) return;
    const box = sheet.getBoundingClientRect();
    const scale = sheet.offsetWidth > 0 ? box.width / sheet.offsetWidth || 1 : 1;
    held = {
      id: event.pointerId,
      from: [event.clientX, event.clientY],
      scale,
      touch,
      moved: false,
    };
    turn.grab([(event.clientX - box.left) / scale, (event.clientY - box.top) / scale]);
  };

  const move = (event: PointerEvent) => {
    if (!held || event.pointerId !== held.id) return;
    const offset: Point = [
      (event.clientX - held.from[0]) / held.scale,
      (event.clientY - held.from[1]) / held.scale,
    ];
    if (moved(offset)) held.moved = true;
    turn.drag(offset, event.timeStamp);
    // Held once it's a turn, not before: a tap's click still reaches its own target.
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
    if (turn.letGo()) swallowUntil = event.timeStamp + CLICK_AFTER_MS;
  };

  const cancel = (event: PointerEvent) => {
    if (held && event.pointerId === held.id) lost();
  };

  /**
   * The pane's own capture lost. Never another's: a finger's touch is held by
   * the element it lands on (the browser's implicit capture), and taking it
   * for the pane passes that element a lostpointercapture which bubbles here.
   */
  const uncaptured = (event: PointerEvent) => {
    if (event.target === of.target) cancel(event);
  };

  /** A drag that turned isn't also a click on the edge, link or page it began on. */
  const click = (event: MouseEvent) => {
    if (event.timeStamp > swallowUntil) return;
    swallowUntil = Number.NEGATIVE_INFINITY;
    event.stopPropagation();
    event.preventDefault();
  };

  /**
   * While the page is held, a drag over the words never chooses them, nor drags a picture. A
   * finger still held where it came down is the system's long press choosing words (it decides
   * when, Android's and iOS's own): the page is let go, and the choosing goes on.
   */
  const still = (event: Event) => {
    if (!held) return;
    if (event.type === 'selectstart' && held.touch && !held.moved) lost();
    else event.preventDefault();
  };

  const listening: [EventTarget, string, EventListener, boolean][] = [
    [of.target, 'pointerdown', down as EventListener, false],
    [window, 'pointermove', move as EventListener, true],
    [window, 'pointerup', up as EventListener, true],
    [window, 'pointercancel', cancel as EventListener, true],
    [of.target, 'lostpointercapture', uncaptured as EventListener, false],
    [of.target, 'click', click as EventListener, true],
    [of.target, 'selectstart', still, false],
    [of.target, 'dragstart', still, false],
  ];
  for (const [target, type, listener, capture] of listening) {
    target.addEventListener(type, listener, capture);
  }
  return () => {
    for (const [target, type, listener, capture] of listening) {
      target.removeEventListener(type, listener, capture);
    }
  };
}
