import { describe, expect, it } from 'vitest';
import { lengthWords, setAsWords } from './imprint';

describe('a book’s imprint (Phase 3d)', () => {
  const set = {
    size: 22,
    leading: 35.2,
    ems: 29.6,
    spread: false,
    justified: true,
    hyphenated: true,
  };

  it('says how the page is set, as it was measured', () => {
    expect(setAsWords(set)).toBe('at 22 on 35 px, lines of 30 em, justified and hyphenated');
    expect(setAsWords({ ...set, spread: true })).toBe(
      'at 22 on 35 px, lines of 30 em a page, justified and hyphenated',
    );
    expect(setAsWords({ ...set, justified: false })).toBe(
      'at 22 on 35 px, lines of 30 em, ragged right and hyphenated',
    );
    // Where the system can't hyphenate, the page is ragged and the imprint says so.
    expect(setAsWords({ ...set, justified: false, hyphenated: false })).toBe(
      'at 22 on 35 px, lines of 30 em, ragged right',
    );
  });

  it('says how long the book is, its pages once they’re counted', () => {
    expect(lengthWords(61, null)).toBe('61 chapters.');
    expect(lengthWords(61, 2450)).toBe('61 chapters, 2,450 pages.');
    expect(lengthWords(1, 1)).toBe('1 chapter, 1 page.');
  });
});
