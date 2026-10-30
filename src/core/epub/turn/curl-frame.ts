// A curling page at one moment (#40, Phase 3), as numbers the window lays
// out: what stays flat, the roll in strips (the paper's front turning away,
// then its back coming over, each as light as it faces you), what lies back
// on top, and the roll's shadow on the page beneath. Each is a clip of the
// live page and, where it's moved, the matrix that lays it, so nothing is
// pictured: the words stay the book's own.

import {
  AT_REST,
  CURL_STRIPS,
  corners,
  cut,
  heldAt,
  type Laid,
  lay,
  onFold,
  type PageBox,
  type Point,
  type Polygon,
  rollOf,
  SEAM,
} from './curl';
import { glintAt, type Light, rampOver, shadeAt, washFrom } from './light';

/** How far the washes along the fold run, in pixels: the window's tokens (--eien-space-6, -5). */
export interface CurlLengths {
  /** The roll's shadow on the page beneath. */
  readonly cast: number;
  /** The light along the crest, where the paper comes back over. */
  readonly crest: number;
}

export interface CurlStrip extends Laid {
  /** Its shade, ramped across it. */
  readonly shade: Light;
  /** Its back, coming over: the words faint through the paper, and a glint. */
  readonly back: boolean;
  readonly glint: Light | null;
}

export type CurlFrame =
  | { readonly resting: true; readonly corner: Point }
  | {
      readonly resting: false;
      /** Where the corner is: the hand's place, or as far as the spine lets it. */
      readonly corner: Point;
      /** What stays flat: the page up to the fold. */
      readonly front: Polygon;
      /** The page beneath, past the fold, and the roll's shadow on it. */
      readonly cast: { readonly clip: Polygon; readonly light: Light };
      /** The roll; none while it's too slight to see. */
      readonly strips: readonly CurlStrip[];
      /** What lies back on top, and the light along its crest. */
      readonly back: Laid & { readonly light: Light };
    };

/** What lies back on top runs from the roll's end this many page-rounds on: past anything the page holds. */
const BEYOND = 4;

/** Below this radius, in pixels, the roll is a crease: no strips are drawn. */
const SLIGHT = 1;

/** The page with its corner resting at `rest` and the hand at `hand`. */
export function curlFrame(
  page: PageBox,
  rest: Point,
  hand: Point,
  lengths: CurlLengths,
): CurlFrame {
  const corner = heldAt(page, rest, hand);
  const roll = rollOf(page, rest, corner);
  if (roll.travel < AT_REST) return { resting: true, corner };
  const { normal: n, radius } = roll;
  const away: Point = [-n[0], -n[1]];
  const half = Math.PI * radius;
  const step = half / CURL_STRIPS;
  const strips: CurlStrip[] = [];
  if (radius >= SLIGHT) {
    for (let i = 0; i < CURL_STRIPS; i++) {
      const [from, to] = [i * step, (i + 1) * step];
      const [start, end] = [(i * Math.PI) / CURL_STRIPS, ((i + 1) * Math.PI) / CURL_STRIPS];
      const back = i >= CURL_STRIPS / 2;
      strips.push({
        ...lay(page, roll, from, to),
        shade: rampOver(page, roll, from, to, shadeAt(start), shadeAt(end)),
        back,
        glint: back ? rampOver(page, roll, from, to, glintAt(start), glintAt(end)) : null,
      });
    }
  }
  const beyond = half + BEYOND * (page.width + page.height);
  return {
    resting: false,
    corner,
    front: cut(corners(page), onFold(roll, SEAM), away),
    cast: {
      clip: cut(corners(page), roll.fold, n),
      light: washFrom(page, onFold(roll, radius), n, lengths.cast),
    },
    strips,
    back: {
      ...lay(page, roll, half, beyond),
      light: washFrom(page, onFold(roll, half), n, lengths.crest),
    },
  };
}
