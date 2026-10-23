// The seal's corners (2026-10-22): a stamp's, from the layout it sits in.
// Each layout sets the corner tokens on :root (ui/chrome/*.css), so a seal
// that names them follows Band, Slip and Running head alike; the small step,
// never past a fifth of its side, so the 10px seal still reads square.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const UI = resolve(import.meta.dirname, '../src/ui');
const ruleOf = (file: string, selector: string) => {
  const css = readFileSync(resolve(UI, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const at = css.indexOf(`${selector} {`);
  expect(at, `${selector} in ${file}`).toBeGreaterThan(-1);
  return css.slice(at, css.indexOf('}', at));
};

describe('the seal’s corners', () => {
  it('take the layout’s small step, at most a fifth of the seal', () => {
    expect(ruleOf('theme/base.css', '.seal')).toContain(
      'border-radius: min(var(--eien-radius-s), 20%)',
    );
  });

  it('take the middle step on the welcome screen’s large seal', () => {
    expect(ruleOf('welcome/welcome.css', '.welcome__seal')).toContain(
      'border-radius: min(var(--eien-radius-m), 20%)',
    );
  });

  it('are set by every layout', () => {
    for (const layout of ['band', 'slip', 'runhead']) {
      const css = readFileSync(resolve(UI, `chrome/${layout}.css`), 'utf8');
      for (const step of ['s', 'm']) expect(css, layout).toContain(`--eien-radius-${step}:`);
    }
  });
});
