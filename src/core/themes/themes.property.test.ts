// Properties of the mix over generated choices: every mix keeps Eien's
// contrast by day and by night, keeps its order of surfaces, and wears
// only tokens that pass spec §7's check; and a theme file's text reads
// back as the mix it was written with.

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  contrast,
  hsl,
  MIX_RANGE,
  type Mix,
  mixPalette,
  readTheme,
  SCHEMES,
  safeTokens,
  shortfalls,
  themeText,
  themeTokens,
} from '.';

const choice = (key: keyof Mix) => {
  const { min, max } = MIX_RANGE[key];
  // Whole steps, as the knobs give, and the odd fraction a hand-written file may hold.
  return fc.oneof(
    fc.integer({ min, max }),
    fc.double({ min, max, noNaN: true }).map((value) => value + 0),
  ); // no -0: JSON writes it as 0
};
const mix: fc.Arbitrary<Mix> = fc.record({
  paper: choice('paper'),
  warmth: choice('warmth'),
  ink: choice('ink'),
  seal: choice('seal'),
});

describe('the mix', () => {
  it('keeps Eien’s contrast, by day and by night, whatever the choices', () => {
    fc.assert(
      fc.property(mix, (choices) => {
        expect(shortfalls(mixPalette(choices))).toEqual([]);
      }),
      { numRuns: 400 },
    );
  });

  it('keeps every ink’s contrast on the raised and well grounds worked out beside the surfaces', () => {
    fc.assert(
      fc.property(mix, (choices) => {
        const tokens = themeTokens(mixPalette(choices));
        const palette = mixPalette(choices);
        for (const scheme of SCHEMES) {
          const hexes = (token: string) =>
            [...(tokens[token] ?? '').matchAll(/#[0-9a-f]{6}/g)].map((m) => m[0]);
          for (const ground of ['--eien-paper-raised', '--eien-well']) {
            const surface = hexes(ground)[scheme] as `#${string}`;
            for (const ink of ['ink', 'ink-soft', 'pencil'] as const) {
              expect(contrast(palette[ink][scheme], surface)).toBeGreaterThanOrEqual(4.5);
            }
          }
        }
      }),
    );
  });

  it('keeps the order of surfaces: darker is further back, by day and by night', () => {
    fc.assert(
      fc.property(mix, (choices) => {
        const palette = mixPalette(choices);
        for (const scheme of SCHEMES) {
          const light = (['desk', 'blotter', 'band', 'paper'] as const).map((surface) =>
            contrast(palette[surface][scheme], '#000000'),
          );
          expect([...light].sort((a, b) => a - b)).toEqual(light);
        }
      }),
    );
  });

  it('wears only tokens that pass the check (spec §7)', () => {
    fc.assert(
      fc.property(mix, (choices) => {
        expect(safeTokens(themeTokens(mixPalette(choices))).refused).toEqual([]);
      }),
    );
  });

  it('keeps the paper’s hue on its surfaces', () => {
    fc.assert(
      fc.property(mix, (choices) => {
        expect(mixPalette(choices).paper[0]).toBe(hsl(choices.paper, choices.warmth, 98.5));
      }),
    );
  });
});

describe('a theme file', () => {
  it('reads back as the mix and name it was written with, other keys kept', () => {
    fc.assert(
      fc.property(
        mix,
        fc.string(),
        fc.dictionary(fc.string(), fc.jsonValue()),
        (choices, name, other) => {
          const text = themeText(JSON.stringify(other), name, choices) ?? '';
          expect(readTheme(text)).toEqual({ mix: choices, problems: [] });
          const parsed = JSON.parse(text) as Record<string, unknown>;
          expect(parsed.name).toBe(name);
          for (const [key, value] of Object.entries(other)) {
            if (key !== 'name' && key !== 'mix')
              expect(parsed[key]).toEqual(JSON.parse(JSON.stringify(value)));
          }
        },
      ),
    );
  });

  it('reads any text without throwing, and never takes a choice out of range', () => {
    fc.assert(
      fc.property(fc.oneof(fc.string(), fc.json()), (text) => {
        const { mix: read } = readTheme(text);
        if (read === null) return;
        for (const key of ['paper', 'warmth', 'ink', 'seal'] as const) {
          expect(read[key]).toBeGreaterThanOrEqual(MIX_RANGE[key].min);
          expect(read[key]).toBeLessThanOrEqual(MIX_RANGE[key].max);
        }
      }),
    );
  });
});
