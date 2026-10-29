// Paste from the places writers paste from: Google Docs (styles, not tags,
// and the whole paste wrapped in a bold that isn't), Word, a code editor
// (whose HTML is only colours: its plain text is what's meant), and plain
// text that is really HTML.

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { declarations } from './css';
import { fromHtml, pastedMarkdown } from './from-html';
import { escapeAttr, type HtmlElement, type HtmlNode, parseHtml } from './html';
import { BLOCK, tidy } from './tidy';
import { type HtmlOptions, toHtml } from './to-html';

const STRAIGHT: HtmlOptions = { quotes: 'straight', sceneBreak: 'spacer' };

const GDOCS_SPAN =
  'font-size:11pt;font-family:Arial,sans-serif;color:#000000;background-color:transparent;font-variant:normal;vertical-align:baseline;white-space:pre;white-space:pre-wrap;';
const span = (style: string, text: string) => `<span style="${GDOCS_SPAN}${style}">${text}</span>`;
const PLAIN = 'font-weight:400;font-style:normal;text-decoration:none;';

const GOOGLE_DOCS = `<meta charset="utf-8"><b style="font-weight:normal;" id="docs-internal-guid-5c1b4f2a-7fff-1d2e-9a3b-0c4d5e6f7a8b"><h2 dir="ltr" style="line-height:1.38;margin-top:18pt;margin-bottom:6pt;">${span(PLAIN, 'Chapter One')}</h2><p dir="ltr" style="line-height:1.38;margin-top:0pt;margin-bottom:0pt;">${span(PLAIN, 'The scarf caught on the ')}${span('font-weight:400;font-style:italic;text-decoration:none;', 'gate')}${span(PLAIN, ', and ')}${span('font-weight:700;font-style:normal;text-decoration:none;', 'tore')}${span(PLAIN, '.')}</p><br><p dir="ltr" style="line-height:1.38;margin-top:0pt;margin-bottom:0pt;">${span(PLAIN, '“Look,” he said. See ')}<a href="https://example.org/" style="text-decoration:none;">${span('color:#1155cc;font-weight:400;font-style:normal;text-decoration:underline;-webkit-text-decoration-skip:none;text-decoration-skip-ink:none;', 'the map')}</a>${span(PLAIN, '. It was ')}${span('font-weight:400;font-style:normal;text-decoration:line-through;', 'wool')}${span(PLAIN, ' silk, the 1')}${span('font-weight:400;font-style:normal;vertical-align:super;', 'st')}${span(PLAIN, ' of its kind.')}</p></b><br class="Apple-interchange-newline">`;

const WORD = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><style><!-- p.MsoNormal {margin:0in;} --></style></head><body lang=EN-US style='tab-interval:.5in'><!--StartFragment--><p class=MsoNormal>She <i style='mso-bidi-font-style:normal'>mended</i> it by the <b style='mso-bidi-font-weight:normal'>fire</b>.<o:p></o:p></p><p class=MsoNormal><o:p>&nbsp;</o:p></p><p class=MsoNormal>The <span style='font-family:"Courier New"'>end</span>.<o:p></o:p></p><!--EndFragment--></body></html>`;

const VS_CODE = `<meta charset='utf-8'><div style="color: #cccccc;background-color: #1f1f1f;font-family: Menlo, Monaco, 'Courier New', monospace;font-weight: normal;font-size: 12px;line-height: 18px;white-space: pre;"><div><span style="color: #569cd6;font-weight: bold;"># Chapter</span></div><br><div><span style="color: #cccccc;">She said </span><span style="color: #cccccc;font-style: italic;">*no*</span></div></div>`;

describe('pastedMarkdown', () => {
  it('reads a Google Docs paste by its styles, and the bold round it as no bold', () => {
    expect(pastedMarkdown(GOOGLE_DOCS, 'Chapter One…')).toBe(
      [
        '# Chapter One',
        'The scarf caught on the *gate*, and **tore**.',
        '“Look,” he said. See [the map](https://example.org/). It was ~~wool~~ silk, the 1<sup>st</sup> of its kind.',
      ].join('\n\n'),
    );
  });

  it('reads Word’s HTML: its tags, not its mso- styles; its empty paragraphs dropped', () => {
    expect(pastedMarkdown(WORD, 'She mended…')).toBe(
      'She *mended* it by the **fire**.\n\nThe end.',
    );
  });

  it('pastes a code editor’s copy as its plain text', () => {
    const text = '# Chapter\n\nShe said *no*';
    expect(pastedMarkdown(VS_CODE, text)).toBeNull();
    expect(
      pastedMarkdown('<pre style="font-family:\'JetBrains Mono\'">x = 1</pre>', 'x = 1'),
    ).toBeNull();
    expect(pastedMarkdown('<meta charset="utf-8"><code>npm start</code>', 'npm start')).toBeNull();
  });

  it('but reads a page with code in it as the page', () => {
    expect(pastedMarkdown('<p>Run it:</p><pre>npm start</pre>', 'Run it:\nnpm start')).toBe(
      'Run it:\n\n```\nnpm start\n```',
    );
  });

  it('reads plain text that is really HTML, and leaves other plain text alone', () => {
    expect(pastedMarkdown('', '<p>Hello</p><p><em>World</em></p>')).toBe('Hello\n\n*World*');
    expect(pastedMarkdown('', 'Just words, 1 < 2.')).toBeNull();
    expect(pastedMarkdown('', '')).toBeNull();
  });

  it('pastes the plain text when the HTML shows nothing', () => {
    expect(pastedMarkdown('<img src="data:image/png;base64,AAAA">', 'x')).toBeNull();
    expect(pastedMarkdown('<p> </p><!-- x -->', 'x')).toBeNull();
  });
});

describe('Word’s lists, hidden words and the edges of a paste', () => {
  const WORD_LIST = (style: string, mark: string, words: string) =>
    `<p class=MsoListParagraph style='${style}'><![if !supportLists]><span style='font-family:Symbol;mso-list:Ignore'>${mark}<span style='font:7.0pt "Times New Roman"'>&nbsp;&nbsp;&nbsp;</span></span><![endif]>${words}<o:p></o:p></p>`;

  it('makes Word’s list paragraphs a list, bulleted or numbered as Word marked them', () => {
    const bullets = ['Needle', 'Thread']
      .map((words) => WORD_LIST('mso-list:l0 level1 lfo1', '·', words))
      .join('\n');
    expect(fromHtml(`<p class=MsoNormal>Kit:</p>${bullets}<p class=MsoNormal>Done.</p>`)).toBe(
      'Kit:\n\n- Needle\n- Thread\n\nDone.',
    );
    const numbers = ['Cut', 'Sew'].map((words, i) =>
      WORD_LIST('mso-list:l1 level1 lfo2', `${i + 3}.`, words),
    );
    expect(fromHtml(numbers.join(''))).toBe('3. Cut\n4. Sew');
  });

  it('leaves out what the page hid: display none, visibility hidden, a site’s landmarks', () => {
    expect(
      fromHtml(
        '<p>Seen <span style="display:none">unseen</span><span style="visibility: hidden">gone</span></p><h3 class="landmark heading">Chapter Text</h3><p>Next</p>',
      ),
    ).toBe('Seen\n\nNext');
  });

  it('reads a definition list’s implied end tags', () => {
    expect(fromHtml('<dl><dt>Name<dd>Ann<dt>Age<dd>30</dl>')).toBe('Name\n\nAnn\n\nAge\n\n30');
  });

  it('keeps the words of HTML nested thousands deep, as a browser does', () => {
    const deep = `${'<b>'.repeat(8000)}deep${'</b>'.repeat(8000)}`;
    expect(fromHtml(deep)).toBe('**deep**');
    const blocks = `${'<div>'.repeat(8000)}deep${'</div>'.repeat(8000)}`;
    expect(fromHtml(blocks)).toBe('deep');
  });

  it('keeps the spaces at the edges of words pasted into a line', () => {
    expect(pastedMarkdown('<span> hello</span>', ' hello')).toBe(' hello');
    expect(pastedMarkdown('<span>hello </span>', 'hello ')).toBe('hello ');
    expect(pastedMarkdown('<p>one</p><p>two</p>', ' one\ntwo ')).toBe('one\n\ntwo');
  });

  it('never makes a tag of a pasted “#word”', () => {
    expect(fromHtml('<p>#hashtag and a#b and # alone</p>')).toBe('\\#hashtag and a#b and # alone');
  });
});

describe('styles as tags', () => {
  const md = (html: string) => fromHtml(html);

  it('adds the marks a style means, together', () => {
    expect(md('<p><span style="font-weight:bold;font-style:italic">both</span> x</p>')).toBe(
      '***both*** x',
    );
    expect(md('<p><span style="font-weight: 600 !important">heavy</span> x</p>')).toBe(
      '**heavy** x',
    );
    expect(md('<p><span style="text-decoration: underline line-through">u</span></p>')).toBe(
      '~~<u>u</u>~~',
    );
    expect(md('<p>H<span style="vertical-align:sub">2</span>O</p>')).toBe('H<sub>2</sub>O');
  });

  it('lets a style undo its own tag, as a browser shows it', () => {
    expect(
      md('<p><b style="font-weight:normal">plain</b> <em style="font-style:normal">too</em></p>'),
    ).toBe('plain too');
    expect(
      md('<p><s style="text-decoration:none">kept</s> <u style="text-decoration:none">too</u></p>'),
    ).toBe('kept too');
    expect(md('<p><b style="font-style:italic">bold italic</b></p>')).toBe('***bold italic***');
  });

  it('never marks what the style doesn’t speak to, or a heading’s own bold, or a link’s underline', () => {
    expect(md('<p><i style="mso-bidi-font-style:normal;font-family:Georgia">it</i></p>')).toBe(
      '*it*',
    );
    expect(md('<h2><span style="font-weight:700">Title</span></h2>')).toBe('# Title');
    expect(
      md('<p><a href="https://x.org"><span style="text-decoration:underline">x</span></a></p>'),
    ).toBe('[x](https://x.org)');
    expect(md('<p><span style="font-weight:400;font-style:normal">plain</span></p>')).toBe('plain');
  });

  it('reads declarations forgivingly', () => {
    expect(declarations(' Font-Weight : BOLD ; ; color:red;nonsense; font-weight:400')).toEqual(
      new Map([
        ['font-weight', '400'],
        ['color', 'red'],
      ]),
    );
  });
});

describe('a link’s address', () => {
  // An address's backslashes were written as they were, and Markdown reads a backslash before
  // punctuation as an escape: "…?q=a\" became "(…?q=a\)", its ")" escaped, so the link was
  // lost and its brackets and address showed as words.
  it('keeps its backslashes, so the link is still a link', () => {
    const hrefs = [
      'https://x.org/?q=C:\\dir\\',
      'https://x.org/?q=\\*a\\*',
      'https://x.org/a b\\', // between "<" and ">", as it has a space
      'https://x.org/a(b)\\\\',
    ];
    for (const href of hrefs) {
      const md = fromHtml(`<p><a href="${href}">l</a></p>`);
      expect(toHtml(md, STRAIGHT), href).toBe(`<p><a href="${escapeAttr(href)}">l</a></p>`);
    }
  });
});

describe('an inline element round blocks', () => {
  it('goes inside each block, so its paragraphs stay paragraphs', () => {
    expect(fromHtml('<b><p>One.</p><p>Two.</p></b>')).toBe('**One.**\n\n**Two.**');
    expect(fromHtml('<em>Lead <p>inside</p> tail</em>')).toBe('*Lead*\n\n*inside*\n\n*tail*');
    expect(fromHtml('<span><blockquote><p>a</p><p>b</p></blockquote></span>')).toBe('> a\n>\n> b');
  });

  it('keeps lists, rules and tables whole', () => {
    expect(fromHtml('<i><ul><li>a</li><li>b</li></ul></i>')).toBe('- *a*\n- *b*');
    expect(fromHtml('<b><p>x</p><hr><p>y</p></b>')).toBe('**x**\n\n***\n\n**y**');
    expect(fromHtml('<span><table><tr><td>a</td><td><b>b</b></td></tr></table></span>')).toBe(
      '| a | **b** |\n| --- | --- |',
    );
  });

  it('a link round blocks links each of them', () => {
    expect(fromHtml('<a href="https://x.org"><div>Card</div><div>More</div></a>')).toBe(
      '[Card](https://x.org)\n\n[More](https://x.org)',
    );
  });
});

/** Every text node's words, in order. */
const words = (nodes: readonly HtmlNode[]): string =>
  nodes.map((node) => (node.kind === 'text' ? node.text : words(node.children))).join('');

/** Whether any inline element holds a block (or a cell) anywhere under it. */
function inlineHoldsBlock(nodes: readonly HtmlNode[], inline = false): boolean {
  return nodes.some((node) => {
    if (node.kind === 'text') return false;
    const structure = BLOCK.has(node.name) || ['td', 'th', 'caption'].includes(node.name);
    if (structure && inline) return true;
    return inlineHoldsBlock(node.children, inline || !structure);
  });
}

describe('tidy, over generated HTML', () => {
  const tag = fc.constantFrom(
    'b',
    'i',
    'em',
    'span',
    'a',
    'u',
    's',
    'p',
    'div',
    'li',
    'ul',
    'td',
    'tr',
    'h2',
    'blockquote',
  );
  const style = fc.constantFrom(
    '',
    ' style="font-weight:700"',
    ' style="font-weight:normal"',
    ' style="font-style:italic;text-decoration:underline"',
    ' style="text-decoration:none"',
    ' style="vertical-align:super"',
  );
  const html: fc.Arbitrary<string> = fc.letrec<{ node: string }>((tie) => ({
    node: fc.oneof(
      { depthSize: 'small', withCrossShrink: true },
      fc.constantFrom('a', 'b c', ' ', '&amp;', '*', 'x'),
      fc.constantFrom('<br>', '<hr>'),
      fc
        .tuple(tag, style, fc.array(tie('node'), { maxLength: 4 }))
        .map(([name, css, inner]) => `<${name}${css}>${inner.join('')}</${name}>`),
    ),
  })).node;

  it('keeps every word, in order, and leaves no block inside an inline element', () => {
    fc.assert(
      fc.property(fc.array(html, { maxLength: 5 }), (parts) => {
        const nodes = parseHtml(parts.join(''));
        const tidied = tidy(nodes);
        expect(words(tidied)).toBe(words(nodes));
        expect(inlineHoldsBlock(tidied)).toBe(false);
      }),
    );
  });

  it('never throws reading it as Markdown', () => {
    fc.assert(
      fc.property(fc.array(html, { maxLength: 5 }), (parts) => {
        expect(typeof fromHtml(parts.join(''))).toBe('string');
      }),
    );
  });
});

describe('the parse is left alone', () => {
  it('tidy builds new nodes and never changes the ones it read', () => {
    const nodes = parseHtml('<b style="font-weight:normal"><p>x</p></b>');
    const before = JSON.stringify(nodes);
    tidy(nodes);
    expect(JSON.stringify(nodes)).toBe(before);
    expect((nodes[0] as HtmlElement).name).toBe('b');
  });
});
