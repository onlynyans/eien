import { describe, expect, it } from 'vitest';
import { fromHtml, looksLikeHtml } from './from-html';
import { decodeEntities, parseHtml } from './html';
import { type Ao3Options, toAo3Html } from './to-html';

const CURLY: Ao3Options = { quotes: 'curly', sceneBreak: 'spacer' };
const STRAIGHT: Ao3Options = { quotes: 'straight', sceneBreak: 'spacer' };
const html = (md: string, options = STRAIGHT) => toAo3Html(md, options);

describe('Copy for AO3: the spec’s table', () => {
  it('paragraphs and line breaks', () => {
    expect(html('One.\n\nTwo,\nthree.')).toBe('<p>One.</p>\n<p>Two,<br />\nthree.</p>');
  });

  it('a scene break as AO3’s spacer, rule, spacer, or a plain rule', () => {
    expect(html('A.\n\n***\n\nB.')).toBe('<p>A.</p>\n<p><br /></p><hr /><p><br /></p>\n<p>B.</p>');
    expect(html('A.\n\n***\n\nB.', { ...STRAIGHT, sceneBreak: 'rule' })).toBe(
      '<p>A.</p>\n<hr />\n<p>B.</p>',
    );
  });

  it('emphasis, strong, strikethrough and underline', () => {
    expect(html('*em* **strong** ~~s~~ <u>u</u>')).toBe(
      '<p><em>em</em> <strong>strong</strong> <s>s</s> <u>u</u></p>',
    );
  });

  it('quotes and headings (a note’s # is AO3’s h2)', () => {
    expect(html('> Said.\n> Twice.')).toBe('<blockquote><p>Said.<br />\nTwice.</p></blockquote>');
    expect(html('# One\n\n## Two\n\n###### Six')).toBe('<h2>One</h2>\n<h3>Two</h3>\n<h6>Six</h6>');
  });

  it('quotes in the words as the setting asks, never in code', () => {
    expect(html('"Look," she said. `"code"`', CURLY)).toBe(
      '<p>“Look,” she said. <code>"code"</code></p>',
    );
    expect(html('*"Hi,"* he said.', CURLY)).toBe('<p><em>“Hi,”</em> he said.</p>');
    expect(html('“Curly.”', STRAIGHT)).toBe('<p>"Curly."</p>');
  });

  it('opens a quote at the start of every paragraph, line, item and cell', () => {
    expect(html('One.\n\n"Two."', CURLY)).toBe('<p>One.</p>\n<p>“Two.”</p>');
    expect(html('One.\n"Two."', CURLY)).toBe('<p>One.<br />\n“Two.”</p>');
    expect(html('One.\\\n"Two."', CURLY)).toBe('<p>One.<br />\n“Two.”</p>');
    expect(html('- a.\n- "b"', CURLY)).toBe('<ul><li>a.</li>\n<li>“b”</li></ul>');
    expect(html('> x.\n\n"y"', CURLY)).toBe('<blockquote><p>x.</p></blockquote>\n<p>“y”</p>');
    expect(html('> x.\n> "y"', CURLY)).toBe('<blockquote><p>x.<br />\n“y”</p></blockquote>');
    expect(html('# T.\n\n"x"', CURLY)).toBe('<h2>T.</h2>\n<p>“x”</p>');
    expect(html('| a. | "b" |\n|---|---|', CURLY)).toBe(
      '<table><tr><th>a.</th><th>“b”</th></tr></table>',
    );
  });

  it('curls a quote by the words before it, not the marks', () => {
    expect(html('He said, **"No."** Then *"\'Tis"* all.', CURLY)).toBe(
      '<p>He said, <strong>“No.”</strong> Then <em>“’Tis”</em> all.</p>',
    );
    expect(html('<u>"Hi"</u> "there"', CURLY)).toBe('<p><u>“Hi”</u> “there”</p>');
  });

  it('leaves out the front matter, and never posts what isn’t prose', () => {
    expect(html('---\nid: ABC\ntags: [x]\n---\nBody.')).toBe('<p>Body.</p>');
    expect(html('[ref]: http://x\n\nText.')).toBe('<p>Text.</p>');
  });
});

describe('Copy for AO3: the rest of a note', () => {
  it('lists, links, images and code as AO3 takes them', () => {
    expect(html('- one\n- two\n\n1. a\n2. b')).toBe(
      '<ul><li>one</li>\n<li>two</li></ul>\n<ol><li>a</li>\n<li>b</li></ol>',
    );
    expect(html('[AO3](https://archiveofourown.org) ![map](map.png)')).toBe(
      '<p><a href="https://archiveofourown.org">AO3</a> <img src="map.png" alt="map" /></p>',
    );
    expect(html('```\nlet x = 1 < 2;\n```')).toBe('<pre>let x = 1 &lt; 2;</pre>');
  });

  it('never links to an address that runs something', () => {
    expect(html('[click](javascript:alert(1))')).toBe('<p>click</p>');
    expect(html('![x](data:image/png;base64,AAAA)')).toBe('<p>x</p>');
  });

  it('a highlight and a wiki link as their words; a checklist with its boxes', () => {
    expect(html('==bright== [[Chapter Two|the next one]] [[Ideas]]')).toBe(
      '<p>bright the next one Ideas</p>',
    );
    expect(html('- [ ] todo\n- [x] done')).toBe('<ul><li>☐ todo</li>\n<li>☑ done</li></ul>');
  });

  it('escapes what would read as HTML, and keeps only the HTML AO3 takes', () => {
    expect(html('1 < 2 & 3 > 2')).toBe('<p>1 &lt; 2 &amp; 3 &gt; 2</p>');
    expect(html('<script>alert(1)</script>')).toBe('<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>');
    expect(html('<p class="x">kept, &amp; plain</p>')).toBe('<p>kept, &amp; plain</p>');
    expect(html('a <span onclick="x()">b</span> c')).toBe(
      '<p>a &lt;span onclick="x()"&gt;b&lt;/span&gt; c</p>',
    );
    expect(html('&amp; \\*not em\\*')).toBe('<p>&amp; *not em*</p>');
  });

  it('a table, with its header', () => {
    expect(html('| a | b |\n|---|---|\n| 1 | 2 |')).toBe(
      '<table><tr><th>a</th><th>b</th></tr>\n<tr><td>1</td><td>2</td></tr></table>',
    );
  });

  it('nothing for an empty note, or one that is only front matter', () => {
    expect(html('')).toBe('');
    expect(html('---\nid: ABC\n---\n')).toBe('');
  });
});

describe('Paste from AO3 (or any HTML)', () => {
  it('paragraphs, dropping AO3’s empty spacers; spacer, rule, spacer is one ***', () => {
    expect(fromHtml('<p>One.</p><p><br /></p><hr /><p>&nbsp;</p><p>Two.</p>')).toBe(
      'One.\n\n***\n\nTwo.',
    );
  });

  it('every tag of the table, in its Markdown form', () => {
    expect(
      fromHtml(
        '<p><em>a</em> <i>b</i> <strong>c</strong> <b>d</b> <s>e</s> <del>f</del> <strike>g</strike> <u>h</u></p>',
      ),
    ).toBe('*a* *b* **c** **d** ~~e~~ ~~f~~ ~~g~~ <u>h</u>');
    expect(fromHtml('<p>One<br />two<br>three</p>')).toBe('One\ntwo\nthree');
    expect(fromHtml('<blockquote><p>Said.</p><p>Again.</p></blockquote>')).toBe(
      '> Said.\n>\n> Again.',
    );
    expect(fromHtml('<h2>Chapter</h2><h3>Part</h3><h1>Title</h1>')).toBe(
      '# Chapter\n\n## Part\n\n# Title',
    );
  });

  it('decodes entities, named and numbered', () => {
    expect(fromHtml('<p>A&nbsp;B &amp; C &#8212; D &#x2014; &hellip; &rsquo;</p>')).toBe(
      'A B & C — D — … ’',
    );
    expect(decodeEntities('&bogus; &#0; &#xD800; &#1114112;')).toBe('&bogus; � � �');
  });

  it('keeps the words of other tags, and drops scripts, styles and comments whole', () => {
    expect(
      fromHtml('<div class="userstuff"><p><span style="x">kept</span> <font>too</font></p></div>'),
    ).toBe('kept too');
    expect(fromHtml('<p>a<script>alert(1)</script>b<style>p{}</style>c<!-- note -->d</p>')).toBe(
      'abcd',
    );
  });

  it('a page of AO3’s own, as copied from a work', () => {
    const page = `<div class="userstuff module" role="article">
<h3 class="landmark heading" id="work">Chapter Text</h3>
<p>The scarf caught on the gate.</p>
<p>“Look,” he began, and <em>stopped</em>.</p>
<p>&nbsp;</p>
<hr />
<p>&nbsp;</p>
<p>She mended it by the fire.</p>
</div>`;
    // "Chapter Text" is AO3's heading for screen readers, hidden on the page: it isn't the writer's.
    expect(fromHtml(page)).toBe(
      'The scarf caught on the gate.\n\n“Look,” he began, and *stopped*.\n\n***\n\nShe mended it by the fire.',
    );
  });

  it('escapes what would read as Markdown in the words', () => {
    expect(fromHtml('<p>2*3*4, a_b, _x_, `c`, [d], ~e~, x^2, a==b, &amp;amp;</p>')).toBe(
      '2\\*3\\*4, a_b, \\_x\\_, \\`c\\`, \\[d\\], \\~e\\~, x\\^2, a\\=\\=b, \\&amp;',
    );
    expect(
      fromHtml(
        '<p># not a heading</p><p>&gt; not a quote</p><p>- not a list</p><p>1. not a list</p>',
      ),
    ).toBe('\\# not a heading\n\n\\> not a quote\n\n\\- not a list\n\n1\\. not a list');
  });

  it('lists, links and images', () => {
    expect(fromHtml('<ul><li>one<li>two</ul><ol start="3"><li>c</li><li>d</li></ol>')).toBe(
      '- one\n- two\n\n3. c\n4. d',
    );
    expect(
      fromHtml(
        '<p><a href="https://x.org/a b">x</a> <a href="javascript:x()">y</a> <img src="m.png" alt="m"></p>',
      ),
    ).toBe('[x](<https://x.org/a b>) y ![m](m.png)');
  });

  it('keeps emphasis marks off the spaces round its words', () => {
    expect(fromHtml('<p><em>word </em>next <strong> bold</strong></p>')).toBe(
      '*word* next **bold**',
    );
    expect(fromHtml('<p><em> </em>x</p>')).toBe('x');
  });

  it('forgives HTML that isn’t closed, or is closed wrong', () => {
    expect(fromHtml('<p>one<p>two<div>three')).toBe('one\n\ntwo\n\nthree');
    expect(fromHtml('<p><em>open</p><p>next</em></p>')).toBe('*open*\n\nnext');
    expect(fromHtml('a < b and <unknown attr=1>c')).toBe('a \\< b and c');
    expect(parseHtml('')).toEqual([]);
  });
});

describe('plain text that is really HTML', () => {
  it('is seen when it starts with a tag and closes one or breaks a line', () => {
    expect(looksLikeHtml('<p>Hello</p><p>World</p>')).toBe(true);
    expect(looksLikeHtml('  <p>Hello<br>World')).toBe(true);
    expect(looksLikeHtml('I wrote <p> in a sentence.')).toBe(false);
    expect(looksLikeHtml('<3 you')).toBe(false);
    expect(looksLikeHtml('<p>an unclosed tag only')).toBe(false);
  });
});

describe('the round trip, Markdown → AO3 → Markdown', () => {
  it('gives back a chapter as written', () => {
    const chapter = [
      '# The Mended Scarf',
      'The scarf caught on the gate, and *tore*.',
      '"Look," he began.\nShe didn\'t.',
      '> A letter, read aloud.\n> Twice.',
      '***',
      '**She** mended it with ~~wool~~ <u>silk</u> by the fire: 2 \\* 3 is six.',
      '## After',
      'The end.',
    ].join('\n\n');
    expect(fromHtml(toAo3Html(chapter, STRAIGHT))).toBe(chapter);
  });

  it('gives back the curly quotes of a note set to curly', () => {
    const note = '“Look,” he said. She didn’t.';
    expect(fromHtml(toAo3Html(note, CURLY))).toBe(note);
  });
});

describe('Copy for AO3: links, code and what’s chosen', () => {
  it('links by the note’s references; brackets that link nowhere stay as written', () => {
    expect(html('[a][map], [map][] and [map].\n\n[map]: <https://x.org/a b>')).toBe(
      '<p><a href="https://x.org/a b">a</a>, <a href="https://x.org/a b">map</a> and <a href="https://x.org/a b">map</a>.</p>',
    );
    expect(html('[a][nope] and [b][] and ![c]')).toBe('<p>[a][nope] and [b][] and ![c]</p>');
  });

  it('a bare address as one a browser follows; an address’s escapes and entities read once', () => {
    expect(html('x me@x.org y')).toBe('<p>x <a href="mailto:me@x.org">me@x.org</a> y</p>');
    expect(html('[a](http://x.org/?a=1&amp;b=\\_c)')).toBe(
      '<p><a href="http://x.org/?a=1&amp;b=_c">a</a></p>',
    );
  });

  it('code, as written, inside a quote or a list', () => {
    expect(html('Text.\n\n    a\n        b\n    c')).toBe('<p>Text.</p>\n<pre>a\n    b\nc</pre>');
    expect(html('>     a\n>         b')).toBe('<blockquote><pre>a\n    b</pre></blockquote>');
    expect(html('> - one\n>\n>   ```\n>   code\n>   ```')).toBe(
      '<blockquote><ul><li><p>one</p>\n<pre>code</pre></li></ul></blockquote>',
    );
  });

  it('what’s chosen: never front matter, its links found in the whole note', () => {
    const note = '---\nid: N1\n---\nOne.\n\n---\n\nSee [the map][map].\n\n[map]: https://x.org';
    const from = note.indexOf('---\n\nSee');
    expect(toAo3Html(note, STRAIGHT, { from, to: note.indexOf('\n\n[map]') })).toBe(
      '<p><br /></p><hr /><p><br /></p>\n<p>See <a href="https://x.org">the map</a>.</p>',
    );
    expect(toAo3Html(note, STRAIGHT, { from: 2, to: 8 })).toBe(''); // only front matter chosen
  });
});
