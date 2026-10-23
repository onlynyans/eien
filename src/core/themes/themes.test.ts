// Themes (spec §7): colours, Eien's contrast, the gallery, the mix, the
// tokens a theme may set, a theme's file, and which theme a setting names.

import { describe, expect, it } from 'vitest';
import {
  contrast,
  FIRST_MIX,
  fitInk,
  GALLERY,
  galleryTheme,
  hsl,
  isMineChoice,
  isThemePath,
  mineChoice,
  mixed,
  mixPalette,
  PALETTE_COLORS,
  readTheme,
  safeTokens,
  shortfalls,
  THEME_TOKENS,
  themeChoice,
  themeFileName,
  themePath,
  themeText,
  themeTitle,
  themeTokens,
  verdictOf,
} from '.';

describe('colours', () => {
  it('makes a colour from hue, saturation and lightness, as CSS does', () => {
    expect(hsl(0, 100, 50)).toBe('#ff0000');
    expect(hsl(120, 100, 25)).toBe('#008000');
    expect(hsl(240, 100, 50)).toBe('#0000ff');
    expect(hsl(0, 0, 100)).toBe('#ffffff');
    expect(hsl(360 + 120, 100, 25)).toBe('#008000'); // any turn
    expect(hsl(-240, 100, 25)).toBe('#008000');
  });

  it('measures contrast as WCAG does, either way round', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrast('#ffffff', '#000000')).toBeCloseTo(21, 5);
    expect(contrast('#777777', '#777777')).toBe(1);
    expect(contrast('#767676', '#ffffff')).toBeCloseTo(4.54, 2);
  });

  it('mixes two colours as color-mix in sRGB', () => {
    expect(mixed('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(mixed('#ff0000', '#0000ff', 1)).toBe('#ff0000');
  });
});

describe('fitInk', () => {
  it('leaves an ink that keeps the contrast where it starts', () => {
    expect(fitInk(30, 40, 10, ['#ffffff'], 4.5, -1)).toBe(hsl(30, 40, 10));
  });

  it('steps darker by day and lighter by night until every ground keeps the contrast', () => {
    const day = fitInk(220, 40, 60, ['#fdfbf7', '#d9d2c8'], 4.5, -1);
    expect(contrast(day, '#d9d2c8')).toBeGreaterThanOrEqual(4.6);
    const night = fitInk(220, 40, 30, ['#28241f', '#38332e'], 4.5, 1);
    expect(contrast(night, '#38332e')).toBeGreaterThanOrEqual(4.6);
  });

  it('ends at black or white when no step of the hue is enough', () => {
    expect(fitInk(60, 100, 50, ['#000000'], 30, -1)).toBe('#000000');
  });
});

describe('the gallery', () => {
  it('holds Eien’s own themes, Paper first, with Slate kept', () => {
    expect(GALLERY.map((theme) => theme.id)).toEqual([
      'paper',
      'linen',
      'indigo',
      'moss',
      'candlelight',
      'ink',
      'blossom',
      'slate',
    ]);
    expect(galleryTheme('linen')?.name).toBe('Linen');
    expect(galleryTheme('nothing')).toBeUndefined();
  });

  it.each(GALLERY.map((theme) => [theme.name, theme] as const))(
    '%s keeps Eien’s contrast by day and by night',
    (_name, theme) => {
      expect(shortfalls(theme.palette)).toEqual([]);
    },
  );

  it.each(GALLERY.map((theme) => [theme.name, theme] as const))(
    '%s keeps the order of surfaces: darker is further back, by day and by night',
    (_name, { palette }) => {
      const order = ['desk', 'blotter', 'band', 'paper'] as const;
      const lum = (scheme: 0 | 1) =>
        order.map((surface) => contrast(palette[surface][scheme], '#000000'));
      const day = lum(0);
      const night = lum(1);
      expect([...day].sort((a, b) => a - b)).toEqual(day);
      expect([...night].sort((a, b) => a - b)).toEqual(night);
    },
  );

  it('has one seal colour per theme, its own', () => {
    const seals = GALLERY.map((theme) => theme.palette.seal.join());
    expect(new Set(seals).size).toBeGreaterThan(1);
  });
});

describe('the mix', () => {
  it('works out every colour, by day and by night', () => {
    const palette = mixPalette(FIRST_MIX);
    for (const color of PALETTE_COLORS) {
      expect(palette[color]).toHaveLength(2);
      for (const value of palette[color]) expect(value).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('keeps the paper’s hue on every surface and the ink’s on the inks', () => {
    const palette = mixPalette({ paper: 215, warmth: 30, ink: 120, seal: 8 });
    expect(palette.paper[0]).toBe(hsl(215, 30, 98.5));
    expect(palette.desk[0]).toBe(hsl(215, 30, 83));
    const [r, g, b] = [1, 3, 5].map((at) => Number.parseInt(palette.ink[0].slice(at, at + 2), 16));
    expect(g).toBeGreaterThan(r as number); // a green ink stays green
    expect(g).toBeGreaterThan(b as number);
  });

  it('stops the night’s warmth, so the dark stays ink', () => {
    expect(mixPalette({ ...FIRST_MIX, warmth: 40 }).paper[1]).toBe(hsl(38, 22, 14));
  });

  it('fits the writing itself to 7:1', () => {
    const palette = mixPalette(FIRST_MIX);
    for (const scheme of [0, 1] as const) {
      expect(contrast(palette.ink[scheme], palette.desk[scheme])).toBeGreaterThanOrEqual(7);
      expect(contrast(palette.ink[scheme], palette.selected[scheme])).toBeGreaterThanOrEqual(7);
    }
  });

  it('keeps Eien’s contrast across the knobs: hues in 15° steps, warmth in steps of 10', () => {
    const steps = (max: number, by: number) =>
      Array.from({ length: max / by + 1 }, (_, i) => i * by);
    let mixes = 0;
    for (const paper of steps(345, 15))
      for (const warmth of steps(40, 10))
        for (const ink of steps(345, 15)) {
          const seal = (paper + ink) % 360; // every seal hue, met along the way
          expect(
            shortfalls(mixPalette({ paper, warmth, ink, seal })),
            `${paper} ${warmth} ${ink}`,
          ).toEqual([]);
          mixes++;
        }
    expect(mixes).toBe(2880);
  });

  it('a yellow seal is darkened until it shows as a mark', () => {
    const palette = mixPalette({ ...FIRST_MIX, seal: 60 });
    expect(contrast(palette.seal[0], palette.paper[0])).toBeGreaterThanOrEqual(3);
    expect(shortfalls(palette)).toEqual([]);
  });
});

describe('the verdict', () => {
  it('says every ink keeps the contrast', () => {
    expect(verdictOf(mixPalette(FIRST_MIX))).toEqual({
      keeps: true,
      words: 'Every ink keeps Eien’s contrast, by day and by night.',
    });
  });

  it('names the first ink that falls short, where and when', () => {
    const paper = galleryTheme('paper')?.palette;
    if (!paper) throw new Error('no Paper');
    const faint = { ...paper, pencil: ['#d0d0d0', paper.pencil[1]] as const };
    const verdict = verdictOf(faint);
    expect(verdict.keeps).toBe(false);
    expect(verdict.words).toMatch(
      /^Under Eien’s contrast: pencil on desk by day, 1\.\d:1 of 4\.5:1\.$/,
    );
  });
});

describe('the tokens a theme sets', () => {
  const tokens = themeTokens(mixPalette(FIRST_MIX));

  it('sets every colour as light-dark(day, night), and only known tokens', () => {
    expect(Object.keys(tokens).sort()).toEqual([...THEME_TOKENS].sort());
    expect(tokens['--eien-paper']).toMatch(/^light-dark\(#[0-9a-f]{6}, #[0-9a-f]{6}\)$/);
    expect(tokens['--eien-rule']).toMatch(
      /^light-dark\(rgb\(\d+ \d+ \d+ \/ 0\.13\), rgb\(\d+ \d+ \d+ \/ 0\.14\)\)$/,
    );
  });

  it('passes its own check whole', () => {
    expect(safeTokens(tokens)).toEqual({ tokens, refused: [] });
  });

  it('keeps out unknown tokens and anything that isn’t a theme’s colour (spec §7)', () => {
    const { tokens: kept, refused } = safeTokens({
      '--eien-paper': 'light-dark(#ffffff, #000000)',
      '--eien-sidebar-w': 'light-dark(#ffffff, #000000)', // a size: not a theme's
      '--eien-ink': 'url(https://example.com/x.png)',
      '--eien-seal': 'light-dark(#ffffff, #000000); display: none',
      '--eien-desk': 'red',
      '--eien-band': 7,
      __proto__: 'light-dark(#ffffff, #000000)',
    });
    expect(kept).toEqual({ '--eien-paper': 'light-dark(#ffffff, #000000)' });
    expect(refused).toEqual([
      '--eien-sidebar-w',
      '--eien-ink',
      '--eien-seal',
      '--eien-desk',
      '--eien-band',
    ]);
  });
});

describe('a theme’s file', () => {
  it('is named for its theme, in .eien/themes', () => {
    expect(themePath('Late Train')).toBe('.eien/themes/Late Train.json');
    expect(themeTitle('Late Train.json')).toBe('Late Train');
    expect(themeTitle('Shouting.JSON')).toBe('Shouting');
    expect(themeTitle('notes.md')).toBeNull();
    expect(themeTitle('.hidden.json')).toBeNull();
    expect(themeTitle('.json')).toBeNull();
    expect(isThemePath('.eien/themes/Late Train.json')).toBe(true);
    expect(isThemePath('.eien/themes/deeper/Late Train.json')).toBe(false);
    expect(isThemePath('.eien/config.json')).toBe(false);
    expect(isThemePath('Late Train.json')).toBe(false);
  });

  it('takes a name a file can have from what the writer typed', () => {
    expect(themeFileName('  Late: Train?  ')).toBe('Late Train.json');
    expect(themeFileName('...')).toBeNull();
    expect(themeFileName('con')).toBe('con-.json');
  });

  it('reads the four choices', () => {
    const text = JSON.stringify({
      name: 'Late Train',
      mix: { paper: 215, warmth: 10, ink: 225, seal: 8 },
    });
    expect(readTheme(text)).toEqual({
      mix: { paper: 215, warmth: 10, ink: 225, seal: 8 },
      problems: [],
    });
    expect(readTheme(`﻿${text}`).mix?.paper).toBe(215); // a byte-order mark is read past
  });

  it('takes the first mix’s choice for one missing or out of range, and says so', () => {
    const { mix, problems } = readTheme(
      JSON.stringify({ mix: { paper: 400, warmth: '10', ink: 225 } }),
    );
    expect(mix).toEqual({ ...FIRST_MIX, ink: 225 });
    expect(problems).toEqual([
      'mix.paper must be a number from 0 to 360; using 38.',
      'mix.warmth must be a number from 0 to 40; using 18.',
      'mix.seal must be a number from 0 to 360; using 12.',
    ]);
    expect(readTheme('{}')).toEqual({
      mix: FIRST_MIX,
      problems: ['It has no "mix"; Eien’s first mix is used.'],
    });
  });

  it('can’t read what isn’t a JSON object', () => {
    for (const text of ['', '{ "mix": ', '[]', 'null', '7']) {
      expect(readTheme(text).mix).toBeNull();
    }
  });

  it('is written with its name and mix, every other key kept', () => {
    const before = JSON.stringify({ mix: { paper: 1 }, made: 'on the laptop', name: 'Old' });
    const text = themeText(before, 'Late Train', { paper: 215, warmth: 10, ink: 225, seal: 8 });
    expect(JSON.parse(text ?? '')).toEqual({
      name: 'Late Train',
      made: 'on the laptop',
      mix: { paper: 215, warmth: 10, ink: 225, seal: 8 },
    });
    expect(text?.endsWith('}\n')).toBe(true);
    expect(themeText(null, 'New', FIRST_MIX)).toBe(
      `${JSON.stringify({ name: 'New', mix: FIRST_MIX }, null, 2)}\n`,
    );
  });

  it('is never written over when it isn’t a JSON object', () => {
    expect(themeText('{ "mix": ', 'Late Train', FIRST_MIX)).toBeNull();
  });

  it('keeps a "__proto__" key as a plain key', () => {
    const text = themeText('{"__proto__": {"polluted": true}}', 'A', FIRST_MIX) ?? '';
    expect(text).toContain('"__proto__"');
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});

describe('which theme a setting names', () => {
  it('names a gallery theme by its id', () => {
    expect(themeChoice('linen')).toEqual({ kind: 'gallery', id: 'linen' });
  });

  it('names the writer’s own as mine: and its name', () => {
    expect(mineChoice('Late Train')).toBe('mine:Late Train');
    expect(themeChoice('mine:Late Train')).toEqual({ kind: 'mine', title: 'Late Train' });
    expect(isMineChoice('mine:Late Train')).toBe(true);
  });

  it('takes no name a theme file can’t have', () => {
    for (const bad of [
      'mine:',
      'mine:a/b',
      'mine:.hidden',
      'mine:con',
      'Late Train',
      'mine:a\\b',
    ]) {
      expect(isMineChoice(bad), bad).toBe(false);
    }
  });

  it('falls back on Paper for a value that names nothing', () => {
    expect(themeChoice('nothing')).toEqual({ kind: 'gallery', id: 'paper' });
    expect(themeChoice('mine:a/b')).toEqual({ kind: 'gallery', id: 'paper' });
  });
});
