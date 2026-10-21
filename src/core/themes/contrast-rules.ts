// Eien's contrast (spec §7, WCAG): what each colour must reach on every
// surface, by day and by night. A theme's verdict and the mix's fitting
// both read it, so the rule is written once.

import { contrast, type Hex } from './color';
import {
  type Palette,
  type PaletteColor,
  SCHEMES,
  type Scheme,
  STATUS_INKS,
  SURFACES,
} from './palette';

/** Text that's read: 4.5:1. Faded (placeholders, what's off) and the seal (a mark): 3:1. */
export const LEAST_CONTRAST = {
  ink: 4.5,
  'ink-soft': 4.5,
  pencil: 4.5,
  faded: 3,
  seal: 3,
  ...Object.fromEntries(STATUS_INKS.map((status) => [status, 4.5])),
} as { readonly [C in Exclude<PaletteColor, (typeof SURFACES)[number]>]: number };

export type Marked = keyof typeof LEAST_CONTRAST;

/** One colour short of Eien's contrast on one surface. */
export interface Shortfall {
  readonly color: Marked;
  readonly surface: (typeof SURFACES)[number];
  readonly scheme: Scheme;
  /** The contrast it has, and the least it needs. */
  readonly ratio: number;
  readonly least: number;
}

/** The surfaces of `palette` in `scheme`. */
export const groundsOf = (
  palette: Pick<Palette, (typeof SURFACES)[number]>,
  scheme: Scheme,
): Hex[] => SURFACES.map((surface) => palette[surface][scheme]);

/** Where `palette` falls short of Eien's contrast; none when it keeps it, by day and by night. */
export function shortfalls(palette: Palette): Shortfall[] {
  const short: Shortfall[] = [];
  for (const scheme of SCHEMES) {
    for (const [color, least] of Object.entries(LEAST_CONTRAST) as [Marked, number][]) {
      for (const surface of SURFACES) {
        const ratio = contrast(palette[color][scheme], palette[surface][scheme]);
        if (ratio < least) short.push({ color, surface, scheme, ratio, least });
      }
    }
  }
  return short;
}

/** The verdict in words, for the writer: the first shortfall, or that every ink keeps it. */
export function verdictOf(palette: Palette): { readonly keeps: boolean; readonly words: string } {
  const [first] = shortfalls(palette);
  if (!first)
    return { keeps: true, words: 'Every ink keeps Eien’s contrast, by day and by night.' };
  const when = first.scheme === 0 ? 'by day' : 'by night';
  return {
    keeps: false,
    words: `Under Eien’s contrast: ${first.color} on ${first.surface} ${when}, ${first.ratio.toFixed(1)}:1 of ${first.least}:1.`,
  };
}
