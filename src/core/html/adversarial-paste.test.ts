// Adversarial tests for phase 8, Paste (HTML → Markdown): words never lost,
// a code editor's copy left as it is, nothing dangerous kept, nothing slow.
// Each was written to break the code, and each comment says the defect it caught (as it was, before the fix)
// and why a writer would care.

import { describe, expect, it } from 'vitest';
import { readLine } from '../table';
import { curlyQuotes } from '../typography';
import { fromHtml, pastedMarkdown } from './from-html';
import { type HtmlOptions, toHtml } from './to-html';

const CURLY: HtmlOptions = { quotes: 'curly', sceneBreak: 'spacer' };

/** Milliseconds `run` takes. */
function timed(run: () => unknown): number {
  const start = performance.now();
  run();
  return performance.now() - start;
}

describe('Paste: words are never lost', () => {
  // Google Docs puts a nested list straight inside its parent <ul> (not inside an <li>); list()
  // reads only <li> children, so every nested item's words are silently dropped.
  it('keeps the nested items of a Google Docs list', () => {
    const gdocs =
      '<meta charset="utf-8"><b style="font-weight:normal;" id="docs-internal-guid-1a2b"><ul style="margin-top:0;margin-bottom:0;padding-inline-start:48px;"><li dir="ltr" style="list-style-type:disc;font-size:11pt;" aria-level="1"><p dir="ltr" style="line-height:1.38;margin-top:0pt;margin-bottom:0pt;" role="presentation"><span style="font-size:11pt;font-weight:400;font-style:normal;">Alpha</span></p></li><ul style="margin-top:0;margin-bottom:0;padding-inline-start:48px;"><li dir="ltr" style="list-style-type:circle;font-size:11pt;" aria-level="2"><p dir="ltr" style="line-height:1.38;margin-top:0pt;margin-bottom:0pt;" role="presentation"><span style="font-size:11pt;font-weight:400;font-style:normal;">Beta, nested</span></p></li></ul><li dir="ltr" style="list-style-type:disc;font-size:11pt;" aria-level="1"><p dir="ltr" style="line-height:1.38;margin-top:0pt;margin-bottom:0pt;" role="presentation"><span style="font-size:11pt;font-weight:400;font-style:normal;">Gamma</span></p></li></ul></b>';
    const md = pastedMarkdown(gdocs, 'Alpha\nBeta, nested\nGamma') ?? '';
    expect(md).toContain('Alpha');
    expect(md).toContain('Beta, nested');
    expect(md).toContain('Gamma');
  });

  // Words directly inside a <ul>/<ol> but outside its items are dropped the same way.
  it('keeps a list’s words that sit outside its items', () => {
    expect(fromHtml('<ul>Loose words<li>an item</li></ul>')).toContain('Loose words');
  });

  // A table cell's paragraphs are run together with no space: "Line one" + "Line two" becomes
  // "Line oneLine two" (Google Docs and Word put a <p> in every cell).
  it('keeps a space between the paragraphs of a table cell', () => {
    expect(
      fromHtml('<table><tr><td><p>Line one</p><p>Line two</p></td></tr></table>'),
    ).not.toContain('oneLine');
  });

  // Cells and rows whose end tags are left out (valid HTML) nest inside each other, and their
  // words run together: "Name", "Age" become one cell "NameAge".
  it('reads table cells and rows whose end tags are left out', () => {
    const md = fromHtml('<table><tr><td>Name<td>Age<tr><td>Ann<td>30</table>');
    expect(md).not.toContain('NameAge');
    expect(md).not.toContain('Ann30');
  });

  // A table's <caption> is dropped with its words.
  // A cell's pipes were escaped each with a backslash, a pipe already escaped too: code holding
  // "\|" (which inline leaves as it is) became "\\|", an escaped backslash and a pipe that ends the
  // cell, so the row had one cell too many and the table was read as a paragraph of pipes.
  it('keeps a table whole when a cell’s code holds an escaped pipe', () => {
    const md = fromHtml('<table><tr><td><code>a\\|b</code></td><td>c</td></tr></table>');
    const [head = ''] = md.split('\n');
    expect(head).toBe('| `a\\|b` | c |');
    expect(readLine(head).cells).toHaveLength(2);
    expect(toHtml(md, CURLY)).toContain('<table>');
  });

  it('escapes every pipe in a cell’s words once, and a backslash before one', () => {
    const md = (cell: string) =>
      fromHtml(`<table><tr><td>${cell}</td><td>z</td></tr></table>`).split('\n')[0];
    expect(md('a|b')).toBe('| a\\|b | z |');
    expect(md('a\\|b')).toBe('| a\\\\\\|b | z |');
    expect(md('a\\')).toBe('| a\\\\ | z |');
    for (const cell of ['a|b', 'a\\|b', 'a\\', '<code>a|b</code>', '<code>\\</code>|', '\\\\|']) {
      expect(readLine(md(cell) ?? '').cells, cell).toHaveLength(2);
    }
  });

  it('keeps a table’s caption', () => {
    expect(fromHtml('<table><caption>The cast</caption><tr><td>a</td></tr></table>')).toContain(
      'The cast',
    );
  });

  // Text a page shows with white-space: pre-wrap (as Chrome copies it, its line ends kept in the
  // text) loses its line ends: a poem copied from such a page pastes as one line.
  it('keeps the line ends of text shown as pre-wrap', () => {
    const html =
      '<meta charset="utf-8"><span style="color: rgb(0, 0, 0); font-family: Georgia, serif; font-size: 16px; font-style: normal; font-weight: 400; white-space: pre-wrap; display: inline !important;">Roses are red,\nViolets are blue.</span>';
    expect(pastedMarkdown(html, 'Roses are red,\nViolets are blue.')).toBe(
      'Roses are red,\nViolets are blue.',
    );
  });

  it('keeps every word of a story site’s own page, Word and Apple Notes', () => {
    const page =
      '<div class="userstuff module" role="article"><p>He said, “I—” and stopped.</p><p><em>Don’t</em>, she thought. <strong><em>Don’t.</em></strong></p><p>&nbsp;</p><hr /><p>&nbsp;</p><blockquote><p>A letter.</p><p>Two lines.</p></blockquote></div>';
    expect(fromHtml(page)).toBe(
      'He said, “I—” and stopped.\n\n*Don’t*, she thought. ***Don’t.***\n\n***\n\n> A letter.\n>\n> Two lines.',
    );
    const notes =
      '<meta charset="UTF-8"><meta name="Generator" content="Cocoa HTML Writer"><style type="text/css">p.p1 {margin: 0.0px; font: 13.0px \'Helvetica Neue\'}</style><p class="p1">First line</p><p class="p1"><br></p><p class="p1"><b>Bold</b> and <i>italic</i></p>';
    expect(pastedMarkdown(notes, 'x')).toBe('First line\n\n**Bold** and *italic*');
  });
});

describe('Paste: a code editor’s copy is its plain text', () => {
  // On Windows the clipboard's HTML comes wrapped in <html><body><!--StartFragment-->, so isCode
  // sees one <html> element, not VS Code's monospace <div>: code pastes as Markdown, a blank line
  // between every line and its "*" escaped.
  it('from VS Code on Windows', () => {
    const html =
      '<html>\r\n<body>\r\n<!--StartFragment--><div style="color: #cccccc;background-color: #1f1f1f;font-family: Consolas, \'Courier New\', monospace;font-weight: normal;font-size: 14px;line-height: 19px;white-space: pre;"><div><span style="color: #cccccc;">let area = w * h;</span></div><div><span style="color: #cccccc;">print(area)</span></div></div><!--EndFragment-->\r\n</body>\r\n</html>';
    expect(pastedMarkdown(html, 'let area = w * h;\nprint(area)')).toBeNull();
  });

  // JetBrains IDEs copy a whole document (<html><head>…</head><body><pre …>): the same miss, and
  // the code pastes inside ``` fences instead of as it was copied.
  it('from a JetBrains IDE', () => {
    const html =
      '<html><head><meta http-equiv="content-type" content="text/html; charset=UTF-8"></head><body><pre style="background-color:#1e1f22;color:#bcbec4;font-family:\'JetBrains Mono\',monospace;font-size:9.8pt;"><span style="color:#cf8e6d;">val </span>x = <span style="color:#6aab73;">"a"</span></pre></body></html>';
    expect(pastedMarkdown(html, 'val x = "a"')).toBeNull();
  });
});

describe('Paste: nothing dangerous survives', () => {
  it('drops scripts, styles, handlers, javascript: links and data: images', () => {
    const md = fromHtml(
      '<p onclick="x()">a<script>alert(1)</script><style>p{}</style><a href="JavaScript:alert(1)">b</a><img src="data:image/png;base64,AA" onerror="x()"><iframe src="https://evil">c</iframe></p>',
    );
    expect(md).toBe('abc');
  });

  // The link filter only knows a literal "javascript:" prefix: a tab or newline inside it (which a
  // browser ignores, so it still runs script), vbscript: and data: addresses are kept as links in the note.
  it('drops script addresses however they are spelled', () => {
    const md = fromHtml(
      '<p><a href="java&#x09;script:alert(1)">one</a> <a href="vbscript:msgbox(1)">two</a> <a href="data:text/html,&lt;script&gt;alert(1)&lt;/script&gt;">three</a></p>',
    );
    expect(md).toBe('one two three');
  });
});

describe('Performance: nothing freezes the editor', () => {
  it('a long chapter pasted and copied takes well under a second', () => {
    const para =
      '<p>“Don’t,” she said, and <em>meant</em> it. He looked at her &mdash; <strong>really</strong> looked &mdash; and didn’t answer.</p>';
    const html = `<div class="userstuff">${para.repeat(1000)}</div>`; // ~140 KB
    let md = '';
    expect(timed(() => (md = fromHtml(html)))).toBeLessThan(500);
    expect(timed(() => toHtml(md, CURLY))).toBeLessThan(500);
  });

  // An inline tag left open before each paragraph (old HTML's <font>, unclosed spans) nests every
  // later paragraph one deeper, and tidy's spread is quadratic in that depth: ~190 KB took ~0.5–0.8 s.
  it('reads paragraphs under unclosed inline tags in linear time', () => {
    const para =
      '<font face="Verdana" size="2"><p>She looked at him, and he looked back, and neither said a word.</p>';
    const html = para.repeat(1500);
    expect(html.length).toBeLessThan(200_000);
    expect(timed(() => fromHtml(html))).toBeLessThan(200);
  });

  // A line that would read as a table's delimiter row ("-|", "|---|") is escaped; the pattern
  // that found it could split each cell's spaces two ways, so a line of empty cells with words at
  // its end ("-| | | … x") took twice as long for each cell: 20 cells 30 ms, 30 cells 30 s.
  // Timed against the same line with stops for the pipes, on the same machine, not a clock: it ran
  // 7,000 times as long; now about as long, under coverage too.
  it('reads a line of empty cells in linear time', () => {
    const least = (html: string) =>
      Math.min(
        ...[0, 1, 2].map(() => timed(() => Array.from({ length: 10 }, () => fromHtml(html)))),
      );
    const piped = least(`<p>-${'| '.repeat(20)}x</p>`);
    const stopped = least(`<p>-${'. '.repeat(20)}x</p>`);
    expect(piped / stopped).toBeLessThan(20);
  });

  it('still escapes a delimiter row, and only that', () => {
    expect(fromHtml('<p>a<br>-| |</p>')).toBe('a\n\\-| |');
    expect(fromHtml('<p>a<br>| --- | :-: |</p>')).toBe('a\n\\| --- | :-: |');
    expect(fromHtml('<p>a<br>-| | x</p>')).toBe('a\n-| | x');
  });

  // curlyQuotes slices the end of the string it is building for every character, which flattens it
  // each time: one 80 KB run of words with no line break took ~0.8 s, 160 KB ~6 s.
  it('curls the quotes of a long paragraph in linear time', () => {
    const run = '"Hi," she said. '.repeat(5 * 1024); // 80 KB, one line
    expect(timed(() => curlyQuotes(run))).toBeLessThan(200);
  });
});
