// Two fingers swiped across a trackpad (#70), read from the wheel events
// they come as: no gesture's start or end, and a glide after the fingers
// lift. A gesture is the events with no quiet gap between them; it swipes
// once it has gone far enough across, and far more across than down, so a
// scroll's drift sideways never counts and a notched wheel's one or two
// clicks don't either. Then it's spent, so its glide never swipes again,
// until the wheel is quiet, or the glide has died down and a new swipe
// rises in it (the next pane: list, then sidebar).

/** A swipe's way: back (the page pulled to the right, as a browser goes back), or on. */
export type SwipeWay = 'back' | 'on';

/** How far across a swipe goes, in CSS pixels, before it counts. */
export const ACROSS = 120;
/** How many times more across than down. */
export const STEEP = 2;
/** Events a swipe has before it counts: a wheel's notch is one, a trackpad's are many. */
export const EVENTS = 4;
/** The quiet, in milliseconds, that ends a gesture. */
export const QUIET_MS = 150;
/** A glide this small is dying down. */
const STILL = 4;
/** How many dying events in a row end a glide, so a slow stroke speeding up is still the one. */
const DYING = 3;
/** A new swipe rising in a dead glide: this far in one event, and twice the last. */
const RISE = 8;

export class WheelSwipe {
  #x = 0;
  #y = 0;
  #events = 0;
  #last = Number.NEGATIVE_INFINITY;
  /** Swiped already: the rest of this gesture is its glide. */
  #spent = false;
  #dying = 0;
  #before = 0;

  /** A wheel event's deltas (CSS pixels) at `time` (ms): the way it swiped, once, or null. */
  wheel(dx: number, dy: number, time: number): SwipeWay | null {
    const across = Math.abs(dx);
    if (time - this.#last >= QUIET_MS) this.#begin();
    else if (this.#spent) {
      // A glide that died down, then a stroke rising in it: a new swipe.
      const risen = this.#dying >= DYING && across >= RISE && across >= 2 * this.#before;
      this.#dying = across <= STILL ? this.#dying + 1 : 0;
      if (risen) this.#begin();
    }
    this.#last = time;
    this.#before = across;
    if (this.#spent) return null;
    this.#x += dx;
    this.#y += dy;
    this.#events += 1;
    const far = Math.abs(this.#x) >= ACROSS && Math.abs(this.#x) >= STEEP * Math.abs(this.#y);
    if (!far || this.#events < EVENTS) return null;
    this.#spent = true;
    this.#dying = 0;
    return this.#x < 0 ? 'back' : 'on';
  }

  /** A wheel event at `time` that's something else's (over what scrolls sideways): its gesture never swipes. */
  pass(time: number): void {
    this.#last = time;
    this.#begin();
    this.#spent = true;
  }

  #begin(): void {
    this.#x = 0;
    this.#y = 0;
    this.#events = 0;
    this.#spent = false;
    this.#dying = 0;
  }
}
