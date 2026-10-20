// Adversarial: a note's preview (phase 6a) cut inside an emoji that is
// several code points: a family, a flag, a skin tone.

import { describe, expect, it } from 'vitest';
import { PREVIEW_LENGTH, readNote } from './index';

const graphemes = (text: string) =>
  [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)].map(
    (part) => part.segment,
  );

describe('preview, adversarial', () => {
  it('never splits an emoji made of several code points', () => {
    // summary.ts cuts "by code point: an emoji stays whole" — not a ZWJ family or a flag.
    for (const emoji of ['👨‍👩‍👧', '🇯🇵', '👍🏽']) {
      const raw = `${'a'.repeat(PREVIEW_LENGTH - 1)}${emoji} and more`;
      const preview = readNote(raw, 'Title').preview;
      const last = graphemes(preview).at(-1) ?? '';
      expect([emoji, 'a']).toContain(last);
    }
  });
});
