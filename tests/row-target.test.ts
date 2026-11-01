// Text size scales the words, down to half (#72), and a row's height with
// them; but a row is something you press, so it never goes under WCAG 2.5.8's
// 24px target, at any Text size, in any density, wherever it's set.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { settingOf } from '../src/core/config';
import { SRC, stylesheets } from './stylesheets';

const UI = join(SRC, 'ui');
const TOKENS = readFileSync(join(UI, 'theme/tokens.css'), 'utf8');

/** A length token's px, as tokens.css sets it on :root. */
const px = (token: string): number => {
  const value = new RegExp(`${token}:\\s*([\\d.]+)px;`, 'u').exec(TOKENS)?.[1];
  if (value === undefined) throw new Error(`${token} isn't a length in tokens.css`);
  return Number(value);
};

/** Every value `--eien-row-h` is given, in every stylesheet of the window. */
const rowHeights = stylesheets(UI).flatMap((file) =>
  [...readFileSync(file, 'utf8').matchAll(/--eien-row-h:\s*([^;]+);/gu)].map(
    (match) => `${file.slice(UI.length + 1)}: ${match[1]}`,
  ),
);

/** `value` in px at `scale`: its tokens put in, its calc() and max() worked out. */
function resolved(value: string, scale: number): number {
  const known: Record<string, number> = { '--eien-text-scale': scale };
  const expression = value
    .replace(/var\((--[\w-]+)\)/gu, (_, token: string) => String(known[token] ?? px(token)))
    .replace(/px/gu, '')
    .replace(/calc\(/gu, '(')
    .replace(/max\(/gu, 'Math.max(');
  if (!/^[\d\s.+\-*/(),Mathmx]+$/u.test(expression)) throw new Error(`can't work out ${value}`);
  return Number(new Function(`return ${expression};`)());
}

describe('a row’s height', () => {
  const size = settingOf('appearance.textSize');
  if (size?.type !== 'number') throw new Error('Text size is a number');
  const scales: number[] = [];
  for (let at = size.min; at <= size.max; at += size.step) scales.push(at / 100);

  it('is set in the tokens and on a touch screen, each found here', () => {
    expect(rowHeights.length).toBeGreaterThanOrEqual(3);
  });

  it('is never under a pointer’s target, at any Text size', () => {
    const target = px('--eien-target');
    expect(target).toBe(24);
    for (const declared of rowHeights) {
      const value = declared.slice(declared.indexOf(': ') + 2);
      for (const scale of scales) {
        expect(resolved(value, scale), `${declared} at ${scale * 100}%`).toBeGreaterThanOrEqual(
          target,
        );
      }
    }
  });

  it('still follows the words above the target', () => {
    const value = /--eien-row-h:\s*([^;]+);/u.exec(TOKENS)?.[1] ?? '';
    expect(resolved(value, 1)).toBe(30);
    expect(resolved(value, 1.3)).toBeCloseTo(39);
    expect(resolved(value, 0.5)).toBe(px('--eien-target'));
  });
});

// Settings' tabs are rows of the text voice too, at 92% of a row's words, with
// no row height of their own: at 50% their words and padding come to under 24px.
describe('a Settings tab', () => {
  const sheet = readFileSync(join(UI, 'settings/settings.css'), 'utf8').replace(
    /\/\*[\s\S]*?\*\//gu,
    '',
  );
  const rule = /(?:^|\n)\.settings__tab\s*\{([^}]*)\}/u.exec(sheet)?.[1] ?? '';

  it('is at least a pointer’s target high', () => {
    expect(rule).toContain('min-height: var(--eien-target);');
  });
});
