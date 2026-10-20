// Adversarial: search (phase 6a) in scripts whose letters carry combining
// marks, and snippets cut where there's no space to cut at.

import { describe, expect, it } from 'vitest';
import { matchesAll, queryTerms, searchText, snippet } from './search';

const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

describe('search, adversarial', () => {
  it('sets accents aside, not the vowel signs of Hindi or Bengali', () => {
    // Devanagari vowel signs (ा ि ी ु ू…) are combining marks (\p{M}), but they are letters:
    // "काम" (work) and "कम" (less) are different words, as are "दिन" (day) and "दन".
    expect(matchesAll(searchText('Diary', 'आज कम लिखा।'), queryTerms('काम'))).toBe(false);
    expect(matchesAll(searchText('Diary', 'दन'), queryTerms('दिन'))).toBe(false);
    // Bengali: "কাজ" (work) is not "কজ".
    expect(matchesAll(searchText('Notes', 'কজ'), queryTerms('কাজ'))).toBe(false);
  });

  it('never starts a snippet with half an emoji, where there’s no space to cut at', () => {
    // Japanese has no spaces to cut at: the cut 36 units before the match lands mid-emoji.
    const plain = `${'雪😀😀'.repeat(40)}針の音`;
    const shown = snippet(plain, ['針']);
    expect(shown).toContain('針の音');
    expect(shown).not.toMatch(LONE_SURROGATE);
  });
});
