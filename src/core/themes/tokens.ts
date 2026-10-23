// A palette as the window wears it (spec §7): the `--eien-*` colour tokens a
// theme overrides on <html>, each light-dark(day, night). The rules, washes
// and the raised and well grounds are worked out from the palette's own
// colours, so they follow it. Only these tokens, with values of these
// shapes, are ever applied (safeTokens): a theme can't touch the layout.

import { type Hex, mixed, rgbOf } from './color';
import { type DayNight, PALETTE_COLORS, type Palette, type PaletteColor } from './palette';

const WHITE: Hex = '#ffffff';

/** A colour at `alpha` (0 to 1), as CSS writes it. */
const see = (hex: Hex, alpha: number) => `rgb(${rgbOf(hex).join(' ')} / ${alpha})`;
const dayNight = (day: string, night: string) => `light-dark(${day}, ${night})`;
const pair = ([day, night]: DayNight) => dayNight(day, night);
/** `color` by day and night, each at its alpha. */
const washOf = ([day, night]: DayNight, dayAlpha: number, nightAlpha: number) =>
  dayNight(see(day, dayAlpha), see(night, nightAlpha));

/** The tokens worked out from a palette, beside its own colours. */
const DERIVED = {
  'paper-raised': (p: Palette) =>
    // By night between paper and selected, so every ink that reads on those reads here.
    dayNight(mixed(p.paper[0], WHITE, 0.45), mixed(p.paper[1], p.selected[1], 0.5)),
  well: (p: Palette) =>
    dayNight(mixed(p.paper[0], p.band[0], 0.7), mixed(p.paper[1], p.blotter[1], 0.6)),
  hover: (p: Palette) => washOf(p.ink, 0.045, 0.05),
  press: (p: Palette) => washOf(p.ink, 0.1, 0.1),
  field: (p: Palette) => washOf(p.ink, 0.06, 0.07),
  'rule-soft': (p: Palette) => washOf(p.ink, 0.07, 0.07),
  rule: (p: Palette) => washOf(p.ink, 0.13, 0.14),
  'rule-strong': (p: Palette) => washOf(p.ink, 0.26, 0.26),
  'seal-wash': (p: Palette) => washOf(p.seal, 0.08, 0.12),
  'on-seal': (p: Palette) => dayNight(p.paper[0], p.desk[1]),
  'added-wash': (p: Palette) => washOf(p.added, 0.13, 0.14),
  'removed-wash': (p: Palette) => washOf(p.removed, 0.1, 0.14),
  'caution-wash': (p: Palette) => washOf(p.caution, 0.11, 0.12),
} as const satisfies Record<string, (palette: Palette) => string>;

const tokenName = (role: PaletteColor | keyof typeof DERIVED) => `--eien-${role}`;

/** Every token a theme may set: the contract's colour tokens, and nothing else. */
export const THEME_TOKENS: readonly string[] = [
  ...PALETTE_COLORS.map(tokenName),
  ...Object.keys(DERIVED).map((role) => tokenName(role as keyof typeof DERIVED)),
];

/** The overrides that wear `palette`: token name → CSS value. */
export function themeTokens(palette: Palette): Record<string, string> {
  return Object.fromEntries([
    ...PALETTE_COLORS.map((color) => [tokenName(color), pair(palette[color])]),
    ...Object.entries(DERIVED).map(([role, derive]) => [
      tokenName(role as keyof typeof DERIVED),
      derive(palette),
    ]),
  ]);
}

const COLOR = String.raw`(?:#[0-9a-f]{6}|rgb\(\d{1,3} \d{1,3} \d{1,3} / (?:0|1|0?\.\d{1,4})\))`;
/** The one shape a theme's value may take: light-dark(colour, colour). */
const VALUE = new RegExp(`^light-dark\\(${COLOR}, ${COLOR}\\)$`);
const KNOWN = new Set(THEME_TOKENS);

/**
 * Spec §7's rule: of `tokens`, only known colour tokens whose values are
 * colours as a theme writes them. The rest is left out and named.
 */
export function safeTokens(tokens: Readonly<Record<string, unknown>>): {
  readonly tokens: Record<string, string>;
  readonly refused: readonly string[];
} {
  const kept: Record<string, string> = {};
  const refused: string[] = [];
  for (const [name, value] of Object.entries(tokens)) {
    if (KNOWN.has(name) && typeof value === 'string' && VALUE.test(value)) kept[name] = value;
    else refused.push(name);
  }
  return { tokens: kept, refused };
}
