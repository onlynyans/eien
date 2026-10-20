// A selector like ".page:hover .tools > *" costs the whole window: the browser
// can't tell which elements a hover (or focus) change touches, so every
// hover anywhere restyles every element under the hovered one — with
// thousands of notes in the panes, a stall the writer feels while typing.
// This test reads every stylesheet and fails on such a selector: after a
// :hover, :focus or :active, the element styled must be named by a class,
// an id, a tag or an attribute.

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = resolve(import.meta.dirname, '../src');

function stylesheets(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return stylesheets(path);
    return entry.name.endsWith('.css') ? [path] : [];
  });
}

/** Every selector in `css`, comments and declarations left out. */
function selectorsOf(css: string): string[] {
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, '');
  return [...bare.matchAll(/([^{}]+)\{/g)]
    .map((match) => (match[1] as string).trim())
    .filter((prelude) => prelude && !prelude.startsWith('@'))
    .flatMap((prelude) => prelude.split(','))
    .map((selector) => selector.trim().replace(/\s+/g, ' '));
}

const DYNAMIC = /:(?:hover|focus|focus-within|focus-visible|active)\b/;

/**
 * Whether `selector` styles an element it can only find by looking at all
 * of them: a hover or focus state on an ancestor, and the element itself
 * named by nothing but "*" or pseudo-classes.
 */
function unboundAfterState(selector: string): boolean {
  const compounds = selector.split(/\s*[>+~]\s*|\s+/).filter(Boolean);
  const last = compounds[compounds.length - 1] ?? '';
  const ancestors = compounds.slice(0, -1);
  if (!ancestors.some((compound) => DYNAMIC.test(compound))) return false;
  return !/[.#[]|^[a-z]/i.test(last.replace(/:{1,2}[\w-]+(\([^)]*\))?/g, ''));
}

describe('unboundAfterState', () => {
  it('flags a universal element after a hover or focus, and nothing else', () => {
    expect(unboundAfterState('.page:hover .page__tools > *')).toBe(true);
    expect(unboundAfterState('.row:focus-within :first-child')).toBe(true);
    expect(unboundAfterState('.page:hover *')).toBe(true);
    expect(unboundAfterState('.page:hover .page__tools')).toBe(false);
    expect(unboundAfterState('.page__tools > *')).toBe(false);
    expect(unboundAfterState('.page__tools:focus-within')).toBe(false);
    expect(unboundAfterState('.row:hover > button')).toBe(false);
    expect(unboundAfterState('.row:hover [data-x]')).toBe(false);
  });
});

describe('the stylesheets', () => {
  it('never style an element found only by a hover or focus state above it', () => {
    const found = stylesheets(SRC).flatMap((file) =>
      selectorsOf(readFileSync(file, 'utf8'))
        .filter(unboundAfterState)
        .map((selector) => `${relative(SRC, file)}: ${selector}`),
    );
    expect(found).toEqual([]);
  });
});
