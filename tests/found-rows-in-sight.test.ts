// A book's Found holds a thousand rows (#40, Phase 5c): those out of sight
// are neither styled nor laid out, in the list and under the book on SHELF,
// or every key typed in the field lays the thousand out again
// (tests/e2e/budgets.spec.ts, a long book searched).

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const LENSES = readFileSync(
  resolve(import.meta.dirname, '../src/ui/list/book-lenses.css'),
  'utf8',
).replace(/\/\*[\s\S]*?\*\//g, '');

/** The declarations of the rule for exactly `selector`. */
function rule(selector: string): string {
  const at = LENSES.indexOf(`${selector} {`);
  expect(at, selector).toBeGreaterThanOrEqual(0);
  return LENSES.slice(at, LENSES.indexOf('}', at));
}

describe('Found’s rows out of sight', () => {
  it('are skipped in the list and on SHELF, each as tall as it will be until it’s drawn', () => {
    for (const selector of ['.rows--found > li', '.tree-row--found']) {
      const declared = rule(selector);
      expect(declared).toContain('content-visibility: auto;');
      expect(declared).toMatch(/contain-intrinsic-block-size: auto\s/u);
    }
  });
});
