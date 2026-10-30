// A book's own links and notes (#40, Phase 2b): a link keeps its address only
// to one of the book's chapters, the places a link may name are kept as
// empty markers (never an id), and a note and its reference are named.

import { describe, expect, it } from 'vitest';
import { elements } from '../../../tests/support/clean-nodes';
import { type CleanNode, plainOf } from '../html';
import { bookLinkOf } from './book-link';
import { chapterOf } from './chapter';

const SPINE = new Set(['OEBPS/text/one.xhtml', 'OEBPS/text/notes.xhtml']);
const read = (body: string) =>
  chapterOf(
    new TextEncoder().encode(body),
    'OEBPS/text/one.xhtml',
    (name) => SPINE.has(name) || name === 'OEBPS/images/a.png',
    (name) => SPINE.has(name),
  ).nodes;

const links = (nodes: readonly CleanNode[]) =>
  [...elements(nodes)]
    .filter((element) => element.name === 'a' && element.attrs.href !== undefined)
    .map((element) => bookLinkOf(element.attrs.href ?? ''));
const anchors = (nodes: readonly CleanNode[]) =>
  [...elements(nodes)].flatMap((element) =>
    element.attrs.anchor === undefined ? [] : [element.attrs.anchor],
  );

describe('a book’s own links', () => {
  it('keep their address to one of the book’s chapters, the place in it apart', () => {
    expect(
      links(
        read(
          '<p><a href="notes.xhtml#n1">1</a> <a href="#here">here</a> <a href="one.xhtml">top</a></p>',
        ),
      ),
    ).toEqual([
      { path: 'OEBPS/text/notes.xhtml', fragment: 'n1' },
      { path: 'OEBPS/text/one.xhtml', fragment: 'here' },
      { path: 'OEBPS/text/one.xhtml', fragment: '' },
    ]);
  });

  it('keep their address to the web or mail, for the system’s browser, as a note’s', () => {
    const nodes = read(
      '<p><a href=" https://www.gutenberg.org/ebooks/1342 ">G</a> <a href="http://a.example/">A</a> <a href="MAILTO:jane@example.com">M</a></p>',
    );
    expect(
      [...elements(nodes)]
        .filter((element) => element.attrs.href)
        .map((element) => element.attrs.href),
    ).toEqual([
      'https://www.gutenberg.org/ebooks/1342',
      'http://a.example/',
      'MAILTO:jane@example.com',
    ]);
  });

  it('keep only their words going anywhere else: a script, data, a file, out of the zip', () => {
    const nodes = read(
      `<p>${[
        'javascript:alert(1)',
        ' jav&#x09;ascript:x()',
        'data:text/html,x',
        'file:///etc/passwd',
        'ftp://example.com/',
        'https:example.com',
        'https://a b',
        '//example.com/x',
        '../images/a.png',
        '../content.opf',
        '../../../../etc/passwd',
        '/OEBPS/text/notes.xhtml%',
        'missing.xhtml#n1',
      ]
        .map((href, n) => `<a href="${href}">w${n}</a>`)
        .join(' ')}</p>`,
    );
    // Each link's words stay, with no address.
    expect([...elements(nodes)].filter((element) => element.attrs.href !== undefined)).toEqual([]);
    expect(plainOf(nodes)).toContain('w0 w1 w2 w3 w4 w5 w6 w7 w8 w9 w10 w11 w12');
  });
});

describe('the places a link may name', () => {
  it('are empty markers where they stood: first in a block, before an inline', () => {
    const nodes = read(
      '<aside id="fn1"><p>A note.</p></aside><p>Words <span id="page12"/>and <a id="ref1" href="notes.xhtml#n1">1</a>.</p><a name="old">x</a>',
    );
    expect(anchors(nodes)).toEqual(['fn1', 'page12', 'ref1', 'old']);
    for (const marker of [...elements(nodes)].filter((element) => element.attrs.anchor)) {
      expect(marker.name).toBe('a');
      expect(marker.children).toEqual([]);
      expect(Object.keys(marker.attrs)).toEqual(['anchor']);
    }
    // The aside's marker is its first thing: the note is the marker's block.
    const aside = nodes.find((node) => node.kind === 'element') as Extract<
      CleanNode,
      { kind: 'element' }
    >;
    expect(aside.children[0]).toEqual({
      kind: 'element',
      name: 'a',
      attrs: { anchor: 'fn1' },
      children: [],
    });
  });

  it('stand in the place of an old link that only names one, not beside it', () => {
    const nodes = read('<a id="filepos12"></a><p>Words.</p><a name="old2"/>');
    expect([...elements(nodes)].filter((element) => element.name === 'a')).toEqual([
      { kind: 'element', name: 'a', attrs: { anchor: 'filepos12' }, children: [] },
      { kind: 'element', name: 'a', attrs: { anchor: 'old2' }, children: [] },
    ]);
  });

  it('keep the first of two the same, and none too long, empty or with control characters', () => {
    const long = 'x'.repeat(257);
    const nodes = read(
      `<p id="a">one</p><p id="a">two</p><p id="${long}">l</p><p id="">e</p><p id="b\u0001c">c</p><p id="${'y'.repeat(256)}">ok</p>`,
    );
    expect(anchors(nodes)).toEqual(['a', 'y'.repeat(256)]);
  });

  it('are never an id or a name the window would read: a book can’t name its elements', () => {
    const nodes = read('<p id="settings" name="body"><span id="__proto__">x</span></p>');
    for (const element of elements(nodes)) {
      expect(element.attrs).not.toHaveProperty('id');
      expect(element.attrs).not.toHaveProperty('name');
    }
    expect(anchors(nodes)).toEqual(['settings', '__proto__']);
  });
});

describe('a note and its reference', () => {
  const parts = (body: string) =>
    [...elements(read(body))].flatMap((element) =>
      element.part ? [`${element.name}:${element.part}`] : [],
    );

  it('are named by EPUB 3’s epub:type and DPUB-ARIA’s roles', () => {
    expect(
      parts(
        '<p><a epub:type="noteref" href="#fn1">1</a> <a role="doc-noteref" href="#fn2">2</a></p><aside epub:type="footnote" id="fn1"><p>One.</p></aside><div role="doc-endnote" id="fn2">Two.</div><li epub:type="rearnote">Three.</li>',
      ),
    ).toEqual(['a:note-ref', 'a:note-ref', 'div:note', 'div:note', 'li:note']);
  });

  it('a note only on a block: never its reference, the sup round it, or a heading', () => {
    expect(
      parts(
        '<p>a<a class="footnote" href="#n1">1</a> b<sup class="footnote"><a href="#n2">2</a></sup></p><h2 class="note">Chapter I.</h2><aside class="footnote" id="n1"><p>x</p></aside>',
      ),
    ).toEqual(['h2:chapter-title', 'div:note']);
  });

  it('by a class, as EPUB 2 books write them, and never a section of notes', () => {
    expect(
      parts(
        '<p class="footnote">One.</p><div class="endnote">Two.</div><section epub:type="endnotes"><p>x</p></section>',
      ),
    ).toEqual(['p:note', 'div:note']);
  });
});
