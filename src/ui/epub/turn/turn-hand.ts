// A hand on a page (#40, Phase 3): where it took hold, what it holds, and
// when its move is a drag across the page rather than a tap or a scroll.

import type { Point, Way } from '../../../core/epub';
import type { CurlRun } from './curl-run';

/** A hand's way before it's a drag: this far across, in pixels, and more across than down. */
export const DRAG_START = 6;

/** A hand on the page: where it took hold, and the curl it holds once it's a drag. */
export interface Hand {
  readonly at: Point;
  holding: CurlRun | null;
  /** A page in flight it caught: a tap on it lets it fly on. */
  readonly caught: boolean;
  /** It moved past the drag's start: no longer a tap. */
  moved: boolean;
  /** It asked for a turn already: under Slide, Words or reduced motion the rest of the drag is nothing. */
  asked: boolean;
  /** Where it is now, and when: a curl still waiting for its page takes it from here. */
  offset: Point;
  time: number;
  /** Lifted while its curl was still waiting for its page. */
  lifted: boolean;
}

export const handAt = (at: Point, holding: CurlRun | null): Hand => ({
  at,
  holding,
  caught: holding !== null,
  moved: false,
  asked: holding !== null,
  offset: [0, 0],
  time: 0,
  lifted: false,
});

/** Whether the hand has moved past a tap. */
export const moved = ([dx, dy]: Point): boolean => Math.hypot(dx, dy) >= DRAG_START;

/** The way a move asks to turn: across past the drag's start, more across than down; drawn leftward, on. */
export function acrossOf([dx, dy]: Point): Way | null {
  if (Math.abs(dx) < DRAG_START || Math.abs(dx) < Math.abs(dy)) return null;
  return dx < 0 ? 1 : -1;
}
