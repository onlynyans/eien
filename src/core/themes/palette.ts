// A theme's colours (spec §7): each of its colour roles by day and by night.
// Every other colour token is worked out from these (./tokens.ts).

import type { Hex } from './color';

/** The grounds, darker further back by day and by night: the sidebar, the page's ground, a band, paper, the chosen row. */
export const SURFACES = ['desk', 'blotter', 'band', 'paper', 'selected'] as const;
/** Four strengths of one ink: the writing, rows, counts and labels, placeholders. */
export const INKS = ['ink', 'ink-soft', 'pencil', 'faded'] as const;
/** What changed and what needs a look: words added, words removed, a conflict. */
export const STATUS_INKS = ['added', 'removed', 'caution'] as const;

/** Every colour a palette holds; the seal is the one accent. */
export const PALETTE_COLORS = [...SURFACES, ...INKS, 'seal', ...STATUS_INKS] as const;
export type PaletteColor = (typeof PALETTE_COLORS)[number];

/** A colour by day, then by night. */
export type DayNight = readonly [day: Hex, night: Hex];

export type Palette = { readonly [C in PaletteColor]: DayNight };

/** By day (0) or by night (1): the index into a DayNight. */
export type Scheme = 0 | 1;
export const SCHEMES: readonly Scheme[] = [0, 1];
