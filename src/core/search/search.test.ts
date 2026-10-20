// Search as a writer types it: any case, accents or not, straight or curly
// quotes, words in any order, and a "quoted phrase".

import { describe, expect, it } from 'vitest';
import { fold, matchesAll, queryTerms, searchText, snippet } from './index';

const finds = (query: string, title: string, plain: string) =>
  matchesAll(searchText(title, plain), queryTerms(query));

describe('fold', () => {
  it('sets case, accents, curly quotes and full-width forms aside', () => {
    expect(fold('Café ÉTÉ naïve Ångström')).toBe('cafe ete naive angstrom');
    expect(fold('don’t “quote” ‘single’')).toBe("don't \"quote\" 'single'");
    expect(fold('ＡＢＣ１２３')).toBe('abc123');
    expect(fold('Straße ΟΔΟΣ οδος')).toBe('strasse οδοσ οδοσ');
    expect(fold('é')).toBe('e');
  });

  it('gives the same length a character at a time as all at once', () => {
    const text = 'İstanbul ΟΔΟΣ ﬁne Straße Ⅻ ①';
    const each = [...text].map((char) => fold(char)).join('');
    expect(each.length).toBe(fold(text).length);
  });
});

describe('queryTerms', () => {
  it('splits words, keeps "quoted phrases" whole, and folds them', () => {
    expect(queryTerms('  Scarf   MENDING ')).toEqual(['scarf', 'mending']);
    expect(queryTerms('"hold it still" scarf')).toEqual(['hold it still', 'scarf']);
    expect(queryTerms('“hold   it” café')).toEqual(['hold it', 'cafe']);
  });

  it('has no terms for nothing, spaces, or empty quotes', () => {
    for (const query of ['', '   ', '""', '" "', '\n\t']) expect(queryTerms(query)).toEqual([]);
  });

  it('takes an unclosed quote as plain words', () => {
    expect(queryTerms('"hold it')).toEqual(['"hold', 'it']);
  });

  it('treats regular-expression characters as text', () => {
    expect(queryTerms('a.*b (x) [y]')).toEqual(['a.*b', '(x)', '[y]']);
    expect(finds('(x)', 'T', 'see (x) here')).toBe(true);
    expect(finds('a.*b', 'T', 'aXXb')).toBe(false);
  });
});

describe('matching', () => {
  it('needs every term, in any order, in the title or the words', () => {
    expect(finds('scarf mended', 'A Mended Scarf', 'Snow.')).toBe(true);
    expect(finds('mended snow', 'A Mended Scarf', 'Snow.')).toBe(true);
    expect(finds('mended rain', 'A Mended Scarf', 'Snow.')).toBe(false);
  });

  it('finds a phrase across a line break, but not across a missing word', () => {
    expect(finds('"hold it still"', 'T', 'hold it\nstill')).toBe(true);
    expect(finds('"hold still"', 'T', 'hold it still')).toBe(false);
  });

  it('finds accented words without accents, and the reverse', () => {
    expect(finds('cafe', 'T', 'Le café')).toBe(true);
    expect(finds('café', 'T', 'Le cafe')).toBe(true);
    expect(finds("don't", 'T', 'I don’t')).toBe(true);
  });

  it('matches nothing for an empty query', () => {
    expect(finds('', 'Anything', 'at all')).toBe(false);
  });
});

describe('snippet', () => {
  it('shows the words around the first match, cut at word boundaries', () => {
    const plain = `${'word '.repeat(40)}the scarf is mended ${'tail '.repeat(40)}`;
    const shown = snippet(plain, ['scarf']);
    expect(shown).toMatch(/^…word /);
    expect(shown).toContain('the scarf is mended');
    expect(shown).toMatch(/tail…$/);
    expect(shown.length).toBeLessThan(140);
  });

  it('starts at the start when the match is near it, and ends at the end when it’s near that', () => {
    expect(snippet('The scarf.', ['scarf'])).toBe('The scarf.');
  });

  it('finds the match’s place even when folding changed lengths before it', () => {
    const plain = `${'ﬁ'.repeat(60)} needle ${'x '.repeat(10)}`;
    expect(snippet(plain, ['needle'])).toContain('needle');
    const decomposed = `${'é'.repeat(80)} needle`;
    expect(snippet(decomposed, ['needle'])).toContain('needle');
  });

  it('shows the start when only the title matched, and collapses whitespace', () => {
    expect(snippet('First\n\n  line   here', ['nothing'])).toBe('First line here');
    expect(snippet('', ['x'])).toBe('');
  });

  it('never splits an emoji', () => {
    const plain = `${'😀'.repeat(50)} needle`;
    const shown = snippet(plain, ['needle']);
    expect(shown).toContain('needle');
    expect(shown).not.toMatch(
      /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/,
    );
  });
});
