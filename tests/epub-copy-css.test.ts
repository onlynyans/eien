// A turn's copy of a book's page (src/ui/epub/sight-copy.ts) holds a run of
// the chapter's blocks, not the chapter: it lays them as the page does only
// while nothing before the run reaches the words in sight but what the copy
// carries: the run's height in its column, the one sibling before each block
// it opens (a hidden shell, for `p + p`'s indent) and a list's numbers. This
// holds the stylesheets to that: no rule on a chapter's words looks further
// back or further on (a sibling's sibling, a child's place among its
// siblings, what follows it), floats a block into the next, or counts.

import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SRC, stylesheets } from './stylesheets';

/** Each rule in `css` as its whole prelude (commas and all) and its declarations, comments left out. */
function rulesOf(css: string): { selector: string; body: string }[] {
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, '');
  return [...bare.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({
    selector: (match[1] as string).trim().replace(/\s+/g, ' '),
    body: match[2] as string,
  }));
}

/** A selector list's selectors, split at its own commas, not those inside a :not() or an :is(). */
function selectorsIn(list: string): string[] {
  const selectors: string[] = [];
  let depth = 0;
  let selector = '';
  for (const char of list) {
    if (char === '(') depth++;
    if (char === ')') depth--;
    if (char === ',' && depth === 0) {
      selectors.push(selector.trim());
      selector = '';
    } else selector += char;
  }
  return [...selectors, selector.trim()];
}

/** What a rule may not ask of what stands before or after a chapter's element. */
const FURTHER = /~|:nth-|:(?:first|last|only)-(?:child|of-type)|:empty|:has\(|\+[^+]*\+/u;

/** The rules on a chapter's words: the part of each selector from `.epub-chapter` on. */
function chapterRules(): { where: string; inside: string; body: string }[] {
  return stylesheets(SRC).flatMap((path) =>
    rulesOf(readFileSync(path, 'utf8')).flatMap(({ selector: list, body }) =>
      selectorsIn(list).flatMap((selector) => {
        const at = selector.indexOf('.epub-chapter');
        if (at < 0) return [];
        return [{ where: relative(SRC, path), inside: selector.slice(at), body }];
      }),
    ),
  );
}

describe('the rules on a book’s words, for a turn’s copy', () => {
  it('finds them', () => {
    expect(chapterRules().length).toBeGreaterThan(10);
  });

  it('look back one sibling at most, and never on', () => {
    const further = chapterRules().filter(({ inside }) => FURTHER.test(inside));
    expect(further.map(({ where, inside }) => `${where}: ${inside}`)).toEqual([]);
  });

  it('float nothing and count nothing', () => {
    const counting = chapterRules().filter(({ body }) =>
      /(?:^|;|\s)(?:float|counter-reset|counter-increment|counter-set)\s*:/u.test(body),
    );
    expect(counting.map(({ where, inside }) => `${where}: ${inside}`)).toEqual([]);
  });
});
