import { describe, expect, it } from 'vitest';
import { assertWellFormedXml } from '../../../tests/support/xml-check';
import { escapeXml, toXhtml, xmlChars } from './xml';

describe('xmlChars', () => {
  it('drops what XML can’t hold: controls, lone surrogates, U+FFFE and U+FFFF', () => {
    expect(xmlChars('a\u0000b\u0001\u000b\u001fc\ud800d￾￿')).toBe('abcd');
    expect(xmlChars('tab\tline\nreturn\r 😀 \u0085 ')).toBe('tab\tline\nreturn\r 😀 \u0085 ');
  });
});

describe('escapeXml', () => {
  it('escapes markup and quotes', () => {
    expect(escapeXml('<a href="x">&\u0001</a>')).toBe(
      '&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;',
    );
  });
});

describe('toXhtml', () => {
  it('writes a note’s references as their characters, but XML’s own five', () => {
    expect(toXhtml('<p>a&nbsp;b&mdash;c &amp; &lt;x&gt; &quot; &#8217; &#x2014;</p>')).toBe(
      '<p>a b—c &amp; &lt;x&gt; &quot; ’ —</p>',
    );
  });

  it('makes a reference that names nothing its words, and drops one to a character XML can’t hold', () => {
    expect(toXhtml('<p>&bogus; &#1; &#0; &#xD800;</p>')).toBe('<p>&amp;bogus;  � �</p>');
  });

  it('drops <big>, which an EPUB may not hold, and keeps its words', () => {
    expect(toXhtml('<p><big>Loud</big></p>')).toBe('<p>Loud</p>');
  });

  it('is well-formed, whatever characters the note held', () => {
    assertWellFormedXml(toXhtml('<p>\u0000&#1;\ud83d&unknown;&amp;</p>'));
  });
});
