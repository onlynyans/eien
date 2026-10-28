// Over generated HTML, hostile pieces among a page's, and rules of any kind:
// the cleaner hands on only elements it keeps, attributes it keeps where they
// belong, addresses the caller's rules gave and parts it knows, and the words
// outside dropped elements stay.

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { elements } from '../../../tests/support/clean-nodes';
import { hostileHtml } from '../../../tests/support/hostile-html';
import { type CleanRules, cleanHtml, plainOf } from './clean';
import { ALIGNED, KEPT, PARTS } from './clean-elements';

/** What a resolver may answer: an address of any kind, words, or no; never a page's own href, so one let through unasked is caught. */
const answer = fc.option(
  fc.oneof(
    fc.string(),
    fc.constantFrom('https://a.example/', 'blob:eien/1', 'javascript:x()', 'data:,x', '#answer'),
  ),
  { nil: null },
);

/** A part's name, known or not, or none. */
const partName = fc.option(
  fc.oneof(fc.constantFrom(...PARTS, 'first-line', 'constructor', '__proto__'), fc.string()),
  { nil: null },
);

/** Generated rules, each answer they give recorded. */
const rules = fc
  .tuple(fc.func(answer), fc.func(answer), fc.func(partName))
  .map(([link, image, part]) => {
    const links = new Set<string>();
    const images = new Set<string>();
    const given = (into: Set<string>, value: string | null) => {
      if (value !== null) into.add(value);
      return value;
    };
    const generated: CleanRules = {
      link: (href) => given(links, link(href)),
      image: (src) => given(images, image(src)),
      part: (source, name) => part(source.name, source.attrs.class, name),
    };
    return { generated, links, images };
  });

const ATTRS = new Set(['href', 'src', 'alt', 'title', 'align']);
const TITLED = new Set(['a', 'abbr', 'img']);
const PART_NAMES = new Set<string>(PARTS);

describe('cleanHtml over generated HTML and rules', () => {
  it('hands on only the elements, attributes, addresses and parts it keeps', () => {
    fc.assert(
      fc.property(hostileHtml, rules, (source, { generated, links, images }) => {
        for (const element of elements(cleanHtml(source, generated))) {
          expect(KEPT.has(element.name)).toBe(true);
          for (const name of Object.keys(element.attrs)) expect(ATTRS.has(name)).toBe(true);
          const { href, src, alt, title, align } = element.attrs;
          if (href !== undefined) {
            expect(element.name).toBe('a');
            expect(links.has(href)).toBe(true);
          }
          if (element.name === 'img') {
            expect(images.has(src ?? '')).toBe(true);
            expect(typeof alt).toBe('string');
          } else {
            expect(src).toBeUndefined();
            expect(alt).toBeUndefined();
          }
          if (title !== undefined) expect(TITLED.has(element.name)).toBe(true);
          if (align !== undefined) expect(ALIGNED.has(element.name)).toBe(true);
          if (element.part !== undefined) expect(PART_NAMES.has(element.part)).toBe(true);
        }
      }),
    );
  });

  it('keeps the words that aren’t inside a dropped element', () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom('<p>', '</p>', '<em>', '</em>', '<hr>', 'Rook', ' '), {
          maxLength: 30,
        }),
        (pieces) => {
          const words = pieces.filter((p) => p === 'Rook').length;
          const nodes = cleanHtml(pieces.join(''), { link: () => null, image: () => null });
          expect(plainOf(nodes).match(/Rook/gu)?.length ?? 0).toBe(words);
        },
      ),
    );
  });
});
