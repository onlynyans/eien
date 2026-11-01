// A curling page at one moment (#40, Phase 3), as numbers the window lays
// out: what stays flat, the roll in strips (the paper's front turning away,
// then its back coming over), what lies back on top, and the roll's shadow
// on the page beneath. Each is a band of the live page (./band.ts): where
// its box lies and, inside it, where the page's paper lies, so nothing is
// pictured (the words stay the book's own) and a frame is transforms alone.

import { type Band, bandOf, flatBand } from './band';
import {
  AT_REST,
  CURL_STRIPS,
  heldAt,
  lay,
  type PageBox,
  type Point,
  radiusAt,
  rollOf,
  SEAM,
} from './curl';

/** How far the washes along the fold run, in pixels: the window's tokens (--eien-space-6, -5). */
export interface CurlLengths {
  /** The roll's shadow on the page beneath. */
  readonly cast: number;
  /** The light along the crest, where the paper comes back over. */
  readonly crest: number;
}

export type CurlFrame =
  | { readonly resting: true; readonly corner: Point; readonly front: Band }
  | {
      readonly resting: false;
      /** Where the corner is: the hand's place, or as far as the spine lets it. */
      readonly corner: Point;
      /**
       * How high the paper stands off the page, of its highest (half way over):
       * 0 to 1, as the roll's radius. The shadows are as strong, so a page
       * lying flat (just taken, or landing) casts none.
       */
      readonly height: number;
      /** What stays flat: the page up to the fold. */
      readonly front: Band;
      /** The roll's shadow on the page beneath, from where the roll stands. */
      readonly cast: Band;
      /** The roll, a band a strip (./light.ts lights each); none while it's too slight to see. */
      readonly strips: readonly Band[];
      /** What lies back on top. */
      readonly back: Band;
      /** The light along its crest. */
      readonly crest: Band;
    };

/** What lies back on top runs from the roll's end this many page-rounds on: past anything the page holds. */
const BEYOND = 4;

/** Below this radius, in pixels, the roll is a crease: no strips are drawn. */
const SLIGHT = 1;

/**
 * How far a band reaches either side of the fold's point: past every corner
 * of the page, wherever the fold is. The fold's point is on the normal
 * through the corner's rest, so along the fold, and back from it, no corner
 * is further than the page's diagonal.
 */
export const reachOf = (page: PageBox): number => Math.hypot(page.width, page.height);

/** The page with its corner resting at `rest` and the hand at `hand`. */
export function curlFrame(
  page: PageBox,
  rest: Point,
  hand: Point,
  lengths: CurlLengths,
): CurlFrame {
  const reach = reachOf(page);
  const corner = heldAt(page, rest, hand);
  const roll = rollOf(page, rest, corner);
  if (roll.travel < AT_REST) return { resting: true, corner, front: flatBand(page, reach) };
  const half = Math.PI * roll.radius;
  const step = half / CURL_STRIPS;
  const strips: Band[] = [];
  if (roll.radius >= SLIGHT) {
    for (let i = 0; i < CURL_STRIPS; i++) {
      const [from, to] = [i * step, (i + 1) * step];
      strips.push(bandOf(roll, from - SEAM, to + SEAM, reach, lay(roll, from, to)));
    }
  }
  const beyond = half + BEYOND * (page.width + page.height);
  const over = lay(roll, half, beyond);
  return {
    resting: false,
    corner,
    height: roll.radius / radiusAt(page, page.width),
    front: bandOf(roll, -reach, SEAM, reach),
    cast: bandOf(roll, roll.radius, roll.radius + lengths.cast, reach),
    strips,
    back: bandOf(roll, half - SEAM, beyond, reach, over),
    crest: bandOf(roll, half, half + lengths.crest, reach, over),
  };
}
