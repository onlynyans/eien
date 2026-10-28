// Over generated HTML, hostile pieces among a story's: the story page is never
// handed an address it doesn't follow (the cleaner's own properties are
// core/html/clean.property.test.ts's).

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { elements } from '../../../tests/support/clean-nodes';
import { hostileHtml } from '../../../tests/support/hostile-html';
import { cleanStory } from './clean';

describe('cleanStory over generated HTML', () => {
  it('links only to the web or mail, and shows images only over https', () => {
    fc.assert(
      fc.property(hostileHtml, (source) => {
        for (const element of elements(cleanStory(source))) {
          if (element.attrs.href !== undefined) {
            expect(element.attrs.href).toMatch(/^(?:https?:\/\/|mailto:)/iu);
          }
          if (element.name === 'img') expect(element.attrs.src).toMatch(/^https:\/\//u);
          expect(element.part).toBeUndefined();
        }
      }),
    );
  });
});
