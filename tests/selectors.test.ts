// A selector like ".page:hover .tools > *" costs the whole window: the browser
// can't tell which elements a hover (or focus) change touches, so every
// hover anywhere restyles every element under the hovered one — with
// thousands of notes in the panes, a stall the writer feels while typing.
// This test reads every stylesheet and fails on such a selector: after a
// :hover, :focus or :active, the element styled must be named by a class,
// an id, a tag or an attribute. So must an element styled under an
// attribute that changes (a layout's [data-layout], a pane's [data-…-shut]):
// one named by nothing but :not() or "*" restyles every element under it
// each time the attribute is set.

import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SRC, stylesheets } from './stylesheets';

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
  return unboundAfter(selector, (compound) => DYNAMIC.test(compound));
}

/** Whether `selector` styles an element named by nothing but "*" or pseudo-classes, under an attribute. */
function unboundAfterAttribute(selector: string): boolean {
  return unboundAfter(selector, (compound) => compound.includes('['));
}

/** `selector`'s compounds, split at its combinators but not inside a :not(), :has() or :nth-child(). */
function compoundsOf(selector: string): string[] {
  const compounds: string[] = [];
  let depth = 0;
  let compound = '';
  for (const char of selector) {
    if (char === '(') depth++;
    if (char === ')') depth--;
    if (depth === 0 && /[\s>+~]/.test(char)) {
      if (compound) compounds.push(compound);
      compound = '';
    } else compound += char;
  }
  return compound ? [...compounds, compound] : compounds;
}

function unboundAfter(selector: string, changes: (compound: string) => boolean): boolean {
  const compounds = compoundsOf(selector);
  const last = compounds[compounds.length - 1] ?? '';
  const ancestors = compounds.slice(0, -1);
  if (!ancestors.some(changes)) return false;
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
    expect(unboundAfterState('.row:hover .button:not(.layer *)')).toBe(false);
    expect(unboundAfterState('.row:hover :not(.layer *)')).toBe(true);
  });
});

describe('unboundAfterAttribute', () => {
  it('flags an element named only by :not() or "*" under an attribute, and nothing else', () => {
    expect(unboundAfterAttribute('[data-layout="band"] .bar > :not([data-command="strip"])')).toBe(
      true,
    );
    expect(unboundAfterAttribute('.shell[data-shut] *')).toBe(true);
    expect(unboundAfterAttribute('[data-layout="band"] .bar > .button:not([data-x])')).toBe(false);
    expect(unboundAfterAttribute('.bar > :not(.x)')).toBe(false);
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

  it('never style an element found only by an attribute above it', () => {
    const found = stylesheets(SRC).flatMap((file) =>
      selectorsOf(readFileSync(file, 'utf8'))
        .filter(unboundAfterAttribute)
        .map((selector) => `${relative(SRC, file)}: ${selector}`),
    );
    expect(found).toEqual([]);
  });
});
