import { describe, expect, it } from 'vitest';
import { fromHtml } from './from-html';
import { hold, settle } from './marks-in-words';

/** A page's paragraph of `words` (its "<" and "&" as a page writes them), pasted. */
const pasted = (words: string) =>
  fromHtml(`<p>${words.replace(/&/gu, '&amp;').replace(/</gu, '&lt;')}</p>`);

describe('the page’s own marks, escaped only where they’d read as Markdown', () => {
  it('keeps brackets that link nowhere as written', () => {
    expect(pasted('See [1], [sic] and [ or ].')).toBe('See [1], [sic] and [ or ].');
    expect(pasted('a [1] (https://x.org) cite')).toBe('a [1] (https://x.org) cite');
  });

  it('escapes brackets that would link, a footnote, a wiki link, a task or a reference', () => {
    // "[a][b]" names a reference the paste doesn't define: words.
    expect(pasted('[a](b) and [a][b]')).toBe('\\[a\\](b) and [a][b]');
    expect(pasted('Wow![a](b)')).toBe('Wow\\!\\[a\\](b)');
    expect(pasted('note[^1] and [[Fire]]')).toBe('note\\[^1\\] and \\[\\[Fire\\]\\]');
    expect(fromHtml('<ul><li>[ ] milk</li></ul>')).toBe('- \\[ \\] milk');
    expect(pasted('[1]: https://x.org')).toBe('\\[1]: https://x.org');
  });

  it('keeps the page’s brackets round a link it holds, and escapes those inside the link', () => {
    expect(fromHtml('<p>[<a href="https://x.org">1</a>]</p>')).toBe('[[1](https://x.org)]');
    expect(fromHtml('<p><a href="https://x.org">a ] b</a></p>')).toBe('[a \\] b](https://x.org)');
    expect(fromHtml('<p>Wow!<a href="https://x.org">a</a></p>')).toBe('Wow\\![a](https://x.org)');
  });

  it('keeps a lone mark, and escapes a pair that would mark the words', () => {
    expect(pasted('5 * 3, x^2, a==b, ~5 km, a_b')).toBe('5 * 3, x^2, a==b, ~5 km, a_b');
    expect(pasted('*one* _two_ ~~three~~ ~4~ ^5^ ==six== `seven`')).toBe(
      '\\*one\\* \\_two\\_ \\~\\~three\\~\\~ \\~4\\~ \\^5\\^ \\=\\=six\\=\\= \\`seven\\`',
    );
  });

  it('keeps "<" that starts no tag, and an "&" that names nothing', () => {
    expect(pasted('a < b, 3<4 & Tom & Jerry')).toBe('a < b, 3<4 & Tom & Jerry');
    expect(pasted('<b>x</b> <http://x.org> &amp; <!-- no -->')).toBe(
      '\\<b>x\\</b> \\<http://x.org> \\&amp; \\<!-- no -->',
    );
  });

  it('keeps a backslash that escapes nothing, and escapes one that would', () => {
    expect(pasted('C:\\Users\\Ann')).toBe('C:\\Users\\Ann');
    expect(pasted('a \\* b')).toBe('a \\\\* b');
  });

  it('escapes a line that would start a list or a rule', () => {
    expect(fromHtml('<p>* item</p>')).toBe('\\* item');
    expect(fromHtml('<p>a<br>***</p>')).toBe('a\n\\*\\*\\*');
  });

  it('keeps the marks Paste writes itself apart from the page’s', () => {
    expect(fromHtml('<p><em>*x</em> and <b>a*b</b></p>')).toBe('*\\*x* and **a*b**');
    expect(fromHtml('<p>2 * <em>3</em> * 4</p>')).toBe('2 * *3* * 4');
  });

  it('drops a noncharacter from the page, which a held mark is', () => {
    expect(pasted('a\uFDD0b\uFDEF')).toBe('ab');
  });

  it('escapes them all in a block of more brackets than it reads', () => {
    const many = '[x] '.repeat(201).trim();
    expect(settle(hold(many))).toBe(many.replace(/[[\]]/gu, '\\$&'));
  });
});
