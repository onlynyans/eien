// Colours as a theme works them out (spec §7): sRGB hex in and out, a hue
// made from HSL, and WCAG's contrast between two colours.

/** "#rrggbb", lower case: the one form a theme's colours take. */
export type Hex = `#${string}`;

const HEX = /^#[0-9a-f]{6}$/;

export const isHex = (value: string): value is Hex => HEX.test(value);

/** A colour's red, green and blue, 0 to 255. */
export function rgbOf(hex: Hex): [number, number, number] {
  return [1, 3, 5].map((at) => Number.parseInt(hex.slice(at, at + 2), 16)) as [
    number,
    number,
    number,
  ];
}

const hexOf = (channels: readonly number[]): Hex =>
  `#${channels
    .map((value) =>
      Math.round(Math.min(255, Math.max(0, value)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;

/**
 * The colour of hue `hue` (degrees, any turn), saturation and lightness
 * `saturation` and `lightness` (0 to 100), in sRGB.
 */
export function hsl(hue: number, saturation: number, lightness: number): Hex {
  const s = clamp(saturation, 0, 100) / 100;
  const l = clamp(lightness, 0, 100) / 100;
  const h = ((hue % 360) + 360) % 360;
  const a = s * Math.min(l, 1 - l);
  const channel = (n: number) => {
    const k = (n + h / 30) % 12;
    return 255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)));
  };
  return hexOf([channel(0), channel(8), channel(4)]);
}

/** `share` (0 to 1) of `a`, the rest `b`, mixed in sRGB as CSS's color-mix does. */
export function mixed(a: Hex, b: Hex, share: number): Hex {
  const [x, y] = [rgbOf(a), rgbOf(b)];
  return hexOf(x.map((value, i) => value * share + (y[i] as number) * (1 - share)));
}

/** WCAG's relative luminance, 0 (black) to 1 (white). */
export function luminance(hex: Hex): number {
  const [r, g, b] = rgbOf(hex).map((value) => {
    const v = value / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG's contrast ratio of two colours, 1 to 21, either way round. */
export function contrast(a: Hex, b: Hex): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
