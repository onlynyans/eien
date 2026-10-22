// A writer's own theme (spec §7): four choices, and every colour worked out
// from them, by day and by night. Each ink keeps its hue and is fitted to
// Eien's contrast (fitInk), so every mix keeps it.

import { contrast, type Hex, hsl } from './color';
import { groundsOf, LEAST_CONTRAST, type Marked } from './contrast-rules';
import { type DayNight, type Palette, type Scheme, STATUS_INKS, SURFACES } from './palette';

/** The four choices: the paper's hue and warmth, the ink's hue, the seal's hue. */
export interface Mix {
  /** Degrees, 0 to 360. */
  readonly paper: number;
  /** The paper's saturation by day, 0 (grey) to 40 (warm). */
  readonly warmth: number;
  readonly ink: number;
  readonly seal: number;
}

export const MIX_KEYS = [
  'paper',
  'warmth',
  'ink',
  'seal',
] as const satisfies readonly (keyof Mix)[];

/** Each choice's range, as the mix panel's knobs offer it. */
export const MIX_RANGE: {
  readonly [K in keyof Mix]: { readonly min: number; readonly max: number };
} = {
  paper: { min: 0, max: 360 },
  warmth: { min: 0, max: 40 },
  ink: { min: 0, max: 360 },
  seal: { min: 0, max: 360 },
};

/** A new theme's mix: the Paper theme's warm paper, a brown ink, a vermilion seal. */
export const FIRST_MIX: Mix = { paper: 38, warmth: 18, ink: 30, seal: 12 };

/** The margin each fitted ink keeps above its least, so rounding never leaves it short. */
const MARGIN = 0.1;

/**
 * An ink of hue `hue` and saturation `saturation`, starting at `lightness`
 * and stepped darker by day (`step` -1) or lighter by night (+1) until it
 * reaches `least` contrast on every one of `grounds`: the hue stays, the
 * contrast holds. Black or white, at the end of the steps, always does.
 */
export function fitInk(
  hue: number,
  saturation: number,
  lightness: number,
  grounds: readonly Hex[],
  least: number,
  step: -1 | 1,
): Hex {
  let l = lightness;
  let ink = hsl(hue, saturation, l);
  while (grounds.some((ground) => contrast(ink, ground) < least + MARGIN) && l > 0 && l < 100) {
    l = Math.min(100, Math.max(0, l + step));
    ink = hsl(hue, saturation, l);
  }
  return ink;
}

/** Where a mixed colour starts, by day and by night: [saturation, lightness]. Hue comes from the mix. */
type Start = readonly [day: readonly [number, number], night: readonly [number, number]];

/** Each ink saturated enough to see its hue by day, and as light (by day) or dark (by night) as the contrast allows. */
const INK_START = {
  ink: [
    [48, 16],
    [38, 88],
  ],
  'ink-soft': [
    [38, 30],
    [30, 70],
  ],
  pencil: [
    [30, 34],
    [20, 62],
  ],
  faded: [
    [20, 46],
    [12, 52],
  ],
  seal: [
    [63, 47],
    [72, 56],
  ],
} as const satisfies Record<string, Start>;

/** The status inks keep Paper's hues (moss, carmine, ochre), fitted to the theme's surfaces. */
const STATUS_START = {
  added: {
    hue: [85, 90],
    start: [
      [35, 27],
      [28, 61],
    ],
  },
  removed: {
    hue: [344, 346],
    start: [
      [51, 38],
      [68, 73],
    ],
  },
  caution: {
    hue: [39, 39],
    start: [
      [55, 27],
      [56, 58],
    ],
  },
} as const satisfies Record<
  (typeof STATUS_INKS)[number],
  { hue: readonly [number, number]; start: Start }
>;

/** Surface lightness by day and by night: darker is further back. */
const SURFACE_LIGHTNESS = {
  desk: [83, 5],
  blotter: [89, 8],
  band: [94, 11],
  paper: [98.5, 14],
  selected: [91, 19],
} as const satisfies Record<(typeof SURFACES)[number], readonly [number, number]>;

/** By night the paper's warmth stops here, so the dark stays ink and not colour. */
const NIGHT_WARMTH = 22;

/** What each colour is fitted to: Eien's least, and the writing itself to 7:1 (WCAG's AAA). */
const FIT_TO: Record<Marked, number> = { ...LEAST_CONTRAST, ink: 7 };

/** Day (0) steps an ink darker, night (1) lighter. */
const STEP: Record<Scheme, -1 | 1> = { 0: -1, 1: 1 };

/** A colour of hue `hue` fitted to `palette`'s surfaces as `color` must be, by day and night. */
function fitted(
  surfaces: Pick<Palette, (typeof SURFACES)[number]>,
  color: Marked,
  hues: readonly [number, number],
  start: Start,
): DayNight {
  const each = (scheme: Scheme) => {
    const [saturation, lightness] = start[scheme];
    const grounds = groundsOf(surfaces, scheme);
    return fitInk(hues[scheme], saturation, lightness, grounds, FIT_TO[color], STEP[scheme]);
  };
  return [each(0), each(1)];
}

/** The status inks for `surfaces`: Paper's hues, each fitted to them. */
export function statusInksFor(
  surfaces: Pick<Palette, (typeof SURFACES)[number]>,
): Pick<Palette, (typeof STATUS_INKS)[number]> {
  const [added, removed, caution] = STATUS_INKS.map((status) =>
    fitted(surfaces, status, STATUS_START[status].hue, STATUS_START[status].start),
  ) as [DayNight, DayNight, DayNight];
  return { added, removed, caution };
}

/** Every colour of a theme, worked out from its four choices. */
export function mixPalette(mix: Mix): Palette {
  const surface = (surface: (typeof SURFACES)[number]): DayNight => {
    const [day, night] = SURFACE_LIGHTNESS[surface];
    return [
      hsl(mix.paper, mix.warmth, day),
      hsl(mix.paper, Math.min(mix.warmth, NIGHT_WARMTH), night),
    ];
  };
  const surfaces = Object.fromEntries(SURFACES.map((name) => [name, surface(name)])) as Pick<
    Palette,
    (typeof SURFACES)[number]
  >;
  const ink = (color: keyof typeof INK_START, hue: number) =>
    fitted(surfaces, color, [hue, hue], INK_START[color]);
  return {
    ...surfaces,
    ink: ink('ink', mix.ink),
    'ink-soft': ink('ink-soft', mix.ink),
    pencil: ink('pencil', mix.ink),
    faded: ink('faded', mix.ink),
    seal: ink('seal', mix.seal),
    ...statusInksFor(surfaces),
  };
}
