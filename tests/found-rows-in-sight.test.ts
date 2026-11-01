// A book's Found holds a thousand rows (#40, Phase 5c): those out of sight
// are neither styled nor laid out, in the list and under the book on SHELF,
// or every key typed in the field lays the thousand out again
// (tests/e2e/budgets.spec.ts, a long book searched). The rows carry the
// classes it names: src/ui/list/found-rows.test.ts, src/ui/sidebar/shelf-rows.test.ts.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const LENSES = readFileSync(
  resolve(import.meta.dirname, '../src/ui/list/book-lenses.css'),
  'utf8',
).replace(/\/\*[\s\S]*?\*\//g, '');

/** The stylesheet's rules, each selector of a list on its own, in order. */
const RULES = [...LENSES.matchAll(/([^{}]+)\{([^{}]*)\}/gu)].flatMap(([, selectors, body]) =>
  (selectors ?? '').split(',').map((selector) => ({
    selector: selector.trim().replace(/\s+/gu, ' '),
    body: body ?? '',
  })),
);

/** What the last rule for `selector` that says `property` says. */
const last = (selector: string, property: string) =>
  RULES.filter((rule) => rule.selector === selector)
    .map((rule) => new RegExp(`${property}:([^;]+);`, 'u').exec(rule.body)?.[1])
    .filter((value) => value !== undefined)
    .at(-1)
    ?.replace(/\s+/gu, ' ')
    .trim();

describe('Found’s rows out of sight', () => {
  it('are skipped in the list and on SHELF, each as tall as it will be until it’s drawn', () => {
    for (const selector of ['.rows--found > li', '.tree-row--found']) {
      expect(last(selector, 'content-visibility'), selector).toBe('auto');
      expect(last(selector, 'contain-intrinsic-block-size'), selector).toMatch(/^auto \S/u);
    }
  });

  it('are the only rows skipped: a lens, a chapter or a mark is always drawn', () => {
    const skipping = RULES.filter((rule) => /content-visibility:\s*auto/u.test(rule.body));
    expect(skipping.map((rule) => rule.selector).sort()).toEqual([
      '.rows--found > li',
      '.tree-row--found',
    ]);
  });
});
