// Adversarial tests for phase 8, Copy for AO3 (Markdown → AO3 HTML) and
// the round trip back. Each was written to break the code, and each
// comment says the defect it caught (as it was, before the fix) and why a writer would care; the rest pin
// what matters (safety, the front matter, ordinary fiction coming back).

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { fromHtml } from './from-html';
import { type Ao3Options, toAo3Html } from './to-html';

const CURLY: Ao3Options = { quotes: 'curly', sceneBreak: 'spacer' };
const STRAIGHT: Ao3Options = { quotes: 'straight', sceneBreak: 'spacer' };
const ao3 = (md: string, options = STRAIGHT) => toAo3Html(md, options);

/** What's wrong with AO3 HTML: tags that aren't AO3's, handlers, script URLs, tags that overlap or stay open. */
function problems(html: string): string[] {
  const allowed = new Set(
    'p br hr em strong s u i b del ins sup sub small big cite q blockquote h2 h3 h4 h5 h6 ul ol li pre code a img table tr td th div'.split(
      ' ',
    ),
  );
  const found: string[] = [];
  const open: string[] = [];
  for (const match of html.matchAll(/<(\/?)([A-Za-z][A-Za-z0-9]*)([^>]*)>/gu)) {
    const [tag, closing, name = '', attrs = ''] = match;
    if (/\son\w+\s*=/iu.test(attrs)) found.push(`handler: ${tag}`);
    if (/(?:href|src)\s*=\s*"\s*(?:javascript|data|vbscript):/iu.test(attrs))
      found.push(`url: ${tag}`);
    if (!allowed.has(name)) found.push(`tag: ${tag}`);
    if (name === 'br' || name === 'hr' || name === 'img') continue;
    if (!closing) open.push(name);
    else if (open.pop() !== name) found.push(`overlaps: ${tag}`);
  }
  if (open.length) found.push(`left open: ${open.join(', ')}`);
  return found;
}

describe('Copy for AO3: the writer’s words reach AO3', () => {
  // Brackets with no address are dropped: "[sic]" posts as "sic", "[...]" as "...", "[laughs]" as
  // "laughs". Spec §4 says they keep their brackets; a writer's quotations and transcripts change silently.
  it('keeps brackets that aren’t a link: [sic], [...], [laughs]', () => {
    expect(ao3('He said [sic] it.')).toBe('<p>He said [sic] it.</p>');
    expect(ao3('“I went [...] home.”', CURLY)).toBe('<p>“I went [...] home.”</p>');
    expect(ao3('A: [laughs] Okay.')).toBe('<p>A: [laughs] Okay.</p>');
  });

  // A list item holding a paragraph and one more block (a quote, code, a table, a heading) posts
  // only the paragraph: the other block's words never reach AO3 (to-html.ts takes the "one paragraph" path).
  it('posts every block of a list item, not only its first paragraph', () => {
    expect(ao3('- Item one\n\n  > a quote under it')).toContain('a quote under it');
    expect(ao3('- Item one\n\n  ```\n  code line\n  ```')).toContain('code line');
    expect(ao3('- Item one\n\n  | a | b |\n  |---|---|\n  | 1 | 2 |')).toContain('<td>1</td>');
  });

  // Words after a comment on the same line ("<!-- TODO --> She walked in.") are posted as
  // nothing: the line is read as one comment block, so a whole sentence disappears from the chapter.
  it('posts the words after a comment on its line', () => {
    expect(ao3('<!-- TODO: fix this --> She walked in.')).toContain('She walked in.');
    expect(ao3('<!-- a note\nover two lines --> She walked in.\nNext line.')).toContain(
      'She walked in.',
    );
  });

  // A reference-style link ("[the map][map]" with "[map]: https://…" below) posts its words without
  // the link: the address is lost although the note defines it, and AO3 takes links.
  it('keeps a reference link’s address', () => {
    expect(ao3('See [the map][map].\n\n[map]: https://x.org')).toContain('href="https://x.org"');
  });
});

describe('Copy for AO3: quotes as the setting asks', () => {
  // A closing quote after a dash curls the wrong way: "I was going to—" he said posts as
  // “I was going to—“. Interrupted dialogue is everywhere in fiction, and what follows the quote
  // (a space) shows it closes.
  it('closes a quote after an interrupting dash', () => {
    expect(ao3('"I was going to—" he said.', CURLY)).toBe('<p>“I was going to—” he said.</p>');
    expect(ao3("'Wait—' he said.", CURLY)).toBe('<p>‘Wait—’ he said.</p>');
    expect(ao3('He said, "I *never*—"', CURLY)).toBe('<p>He said, “I <em>never</em>—”</p>');
  });

  // An entity before a quote counts as a letter: "&emsp;"Hello," she said." posts as
  // &emsp;”Hello,” — both quotes closing. Writers who indent or space with entities get backwards quotes.
  it('opens a quote after a space written as an entity', () => {
    expect(ao3('&emsp;"Hello," she said.', CURLY)).toBe('<p>&emsp;“Hello,” she said.</p>');
    expect(ao3('&nbsp;"Hello," she said.', CURLY)).toBe('<p>&nbsp;“Hello,” she said.</p>');
  });

  // A quote after the note's own <br> or between its own <p>s is read as closing: the quote
  // starts a new line (or paragraph) on AO3, so it should open.
  it('opens a quote at the start of a line made with the note’s own HTML', () => {
    expect(ao3('One.<br>"Two."', CURLY)).toContain('“Two.”');
    expect(ao3('<p>One.</p><p>"Two."</p>', CURLY)).toContain('“Two.”');
  });
});

describe('Copy for AO3: HTML that AO3 reads as the writer meant', () => {
  // HTML or code inside a quote keeps the quote's ">" marks of its later lines as words:
  // "&gt; world" is posted inside the blockquote.
  it('leaves a quote’s marks out of HTML and code inside it', () => {
    expect(ao3('> <p>Hello\n> world</p>')).not.toContain('&gt;');
    expect(ao3('> ```\n> let x = 1\n> ```')).toBe('<blockquote><pre>let x = 1</pre></blockquote>');
  });

  // A checklist item with a list under it leaves the note's <u> open in its <p> and closes it in
  // the next item: "<p>☐ <u>todo</p><ul><li>sub</u></li></ul>" — overlapping tags, which AO3 may
  // repair by underlining the wrong words.
  it('closes the note’s own tags inside a checklist item with a list under it', () => {
    expect(problems(ao3('- [ ] <u>todo\n  - sub'))).toEqual([]);
  });

  // A bare "www." address (a GFM autolink) is linked as href="www.example.com": on AO3 that is a
  // path on archiveofourown.org, so every reader who clicks it gets a 404.
  it('links a bare www. address to the web, not to a path on AO3', () => {
    expect(ao3('Find me at www.example.com today.')).toMatch(
      /href="https?:\/\/www\.example\.com"/u,
    );
  });

  // An image's description is escaped twice: "Tom & Jerry" becomes alt="Tom &amp;amp; Jerry",
  // which a screen reader reads as "Tom &amp; Jerry".
  it('escapes an image’s description once', () => {
    expect(ao3('![Tom & Jerry](x.png)')).toContain('alt="Tom &amp; Jerry"');
  });

  it('never posts a script, a handler, a script URL, a tag AO3 lacks, or a tag left open', () => {
    const token = fc.constantFrom(
      'word',
      'Dialogue,',
      '"',
      "'",
      '—',
      '…',
      '*',
      '**',
      '_',
      '~~',
      '==',
      '`',
      '[',
      ']',
      '(',
      ')',
      '<u>',
      '</u>',
      '<em>',
      '</em>',
      '<b>',
      '</strong>',
      '<p>',
      '</p>',
      '<div>',
      '</div>',
      '<blockquote>',
      '<script>alert(1)</script>',
      '<img src=x onerror=alert(1)>',
      '<a href="javascript:x()">',
      '<p onclick="x()">',
      '[l](javascript:alert(1))',
      '[l](JaVaScRiPt:alert(1))',
      '![i](data:image/png;base64,AA)',
      '<javascript:alert(1)>',
      '<https://x.org>',
      '&amp;',
      '&nbsp;',
      '&#60;script&#62;',
      '<!--',
      '-->',
      '\\',
      '#',
      '|',
      '<br>',
      '<hr>',
    );
    const line = fc.array(token, { minLength: 1, maxLength: 8 }).map((t) => t.join(' '));
    const block = fc.oneof(
      line,
      fc.array(line, { minLength: 2, maxLength: 3 }).map((l) => l.join('\n')),
      line.map((l) => `# ${l}`),
      fc.tuple(line, line).map(([a, b]) => `> ${a}\n>\n> ${b}`),
      line.map((l) => `- ${l}`),
      line.map((l) => `1. ${l}`),
      fc.tuple(line, line).map(([a, b]) => `- ${a}\n  - ${b}`),
      fc.tuple(line, line).map(([a, b]) => `| ${a} | x |\n|---|---|\n| ${b} | y |`),
      line.map((l) => `\`\`\`\n${l}\n\`\`\``),
      fc.constant('***'),
    );
    const note = fc.array(block, { minLength: 1, maxLength: 5 }).map((b) => b.join('\n\n'));
    fc.assert(
      fc.property(note, (md) => {
        expect(problems(toAo3Html(md, CURLY))).toEqual([]);
      }),
      { numRuns: 1000 },
    );
  });
});

describe('Copy for AO3: the front matter is never posted', () => {
  it('whatever it holds, in LF or CRLF', () => {
    const front = '---\ntitle: "Secret" <b>x</b>\nsummary: [a](https://x.org)\n---\n';
    expect(ao3(`${front}Body.`, CURLY)).toBe('<p>Body.</p>');
    expect(ao3(`${front}Body.`.replace(/\n/gu, '\r\n'), CURLY)).toBe('<p>Body.</p>');
    expect(ao3('---\nid: A\n...\n"Body."', CURLY)).toBe('<p>“Body.”</p>');
  });
});

describe('the round trip, Markdown → AO3 → Markdown', () => {
  it('gives back dialogue-heavy fiction as written, curly quotes and all', () => {
    const chapter = [
      '# Chapter Two',
      '“Don’t,” she said. “It’s not—it isn’t yours.”',
      '‘’Tis the ’90s,’ he said, ‘and rock ’n’ roll.’',
      '“He told me, ‘Never again,’ and left…”',
      '*She* **really** meant it, the boys’ toys and all: 5’10” of *him*.',
      '> A letter.\n>\n> “Two paragraphs,” it said.',
      '***',
      '<u>Underlined</u>, ~~struck~~, and an ampersand: Tom & Jerry.',
      'One line,\nand the next.',
    ].join('\n\n');
    expect(fromHtml(toAo3Html(chapter, CURLY))).toBe(chapter);
  });

  // "\#tag" (a "#" the writer escaped so it isn't a tag) comes back as "#tag": the round trip
  // makes a tag the writer never made, and it shows in the sidebar.
  it('keeps an escaped # from becoming a tag', () => {
    const note = 'Not a \\#tag here.';
    expect(fromHtml(toAo3Html(note, STRAIGHT))).toBe(note);
  });

  // Paste escapes a run of underscores only on its first mark: "__Name__" pastes as
  // "\__Name\__", which reads as "_<em>Name_</em>": two underscores gone and a word italicised.
  it('pastes runs of underscores as the words they are', () => {
    const html = '<p>She wrote __Name__ on it, and __init__ too.</p>';
    expect(toAo3Html(fromHtml(html), STRAIGHT)).toBe(html);
  });
});
