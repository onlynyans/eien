// Adversarial: "case aside, #Draft is #draft" (spec §4) for letters whose
// case pairs aren't one letter to one letter.

import { describe, expect, it } from 'vitest';
import { readNote } from '../note';
import { buildTagTree } from './tree';

describe('tags, adversarial', () => {
  it('is one tag whatever its case, for Turkish İ and German ß too', () => {
    // tagKey lowercases in English: "İ" becomes "i" plus a combining dot, "ß" stays while
    // "SS" becomes "ss". Names are compared with full case folding (nameKey: Straße is STRASSE).
    for (const [a, b] of [
      ['İstanbul', 'istanbul'],
      ['Straße', 'STRASSE'],
    ]) {
      const tags = readNote(`#${a} at the start, #${b} later.`, 'N').tags;
      expect(tags).toHaveLength(1);
      expect(buildTagTree([{ path: 'N.md', tags: [a ?? '', b ?? ''] }])).toHaveLength(1);
    }
  });
});
