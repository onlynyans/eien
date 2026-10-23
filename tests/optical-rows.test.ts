// A row's name sits in the row's middle by its capitals (2026-10-22): its line
// box trimmed to cap and baseline, and half of the rest given back on each
// side, so the row keeps its height in every face, size and density.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const BASE = readFileSync(resolve(import.meta.dirname, '../src/ui/theme/base.css'), 'utf8').replace(
  /\/\*[\s\S]*?\*\//g,
  '',
);

describe('a row’s name', () => {
  it('is trimmed to its capitals and given back half the line each side, in tree and list', () => {
    const block = BASE.slice(BASE.indexOf('@supports (text-box: trim-both cap alphabetic)'));
    const rule = block.slice(0, block.indexOf('}') + 1);
    expect(rule).toContain('.tree-row__label');
    expect(rule).toContain('.note-row__title');
    expect(rule).toContain('text-box: trim-both cap alphabetic;');
    expect(rule).toContain('padding-block: calc((1lh - 1cap) / 2);');
  });
});
