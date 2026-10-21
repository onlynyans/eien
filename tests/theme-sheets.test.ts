// The theme contract against its style sheets (spec §7): every token a
// theme may set is one tokens.css defines, and the gallery's Washi and
// Otaku, worn by their own sheets, are listed with the colours those
// sheets hold, so a card or a verdict never shows another.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { galleryTheme, PALETTE_COLORS, THEME_TOKENS } from '../src/core/themes';

const THEME = resolve(import.meta.dirname, '../src/ui/theme');
const sheet = (name: string) =>
  readFileSync(resolve(THEME, name), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/** Each colour token's light-dark(day, night) in `css`, as hex pairs. */
function colorsOf(css: string): Map<string, string[]> {
  const found = new Map<string, string[]>();
  for (const match of css.matchAll(
    /(--eien-[a-z-]+):\s*light-dark\(\s*(#[0-9a-f]{6}),\s*(#[0-9a-f]{6})\s*\)/g,
  )) {
    found.set(match[1] as string, [match[2] as string, match[3] as string]);
  }
  return found;
}

describe('the theme contract', () => {
  it('lets a theme set only tokens tokens.css defines', () => {
    const defined = new Set(
      [...sheet('tokens.css').matchAll(/(--eien-[a-z-]+):/g)].map((m) => m[1]),
    );
    for (const token of THEME_TOKENS) expect(defined, token).toContain(token);
  });

  it.each([
    ['washi', 'tokens.css'],
    ['otaku', 'otaku.css'],
  ])('lists %s with the colours of %s', (id, file) => {
    const theme = galleryTheme(id);
    if (!theme) throw new Error(`no ${id}`);
    expect(theme.inSheet).toBe(true);
    const colors = colorsOf(sheet(file));
    for (const color of PALETTE_COLORS) {
      expect([...theme.palette[color]], color).toEqual(colors.get(`--eien-${color}`));
    }
  });
});
