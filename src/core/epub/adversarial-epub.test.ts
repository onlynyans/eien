// Hostile books (#40): what a book from anywhere could hold, and what Eien
// does with it. Each is refused, or drawn with nothing that runs, fetches or
// reaches outside the book.

import { describe, expect, it } from 'vitest';
import { fixtureEpubs, SAMPLE_SOURCES } from '../../../tests/support/epub-fixtures';
import { handZip } from '../../../tests/support/epub-zip';
import { inflateRaw } from '../../platform/inflate';
import { type CleanNode, KEPT, plainOf } from '../html';
import { EPUB_CAPS } from './caps';
import { chapterOf } from './chapter';
import { openEpub } from './epub';
import { isRefusal } from './refusal';
import { openZip } from './zip-read';

const EPUBS = fixtureEpubs(SAMPLE_SOURCES);

const walk = (nodes: readonly CleanNode[]): CleanNode[] =>
  nodes.flatMap((node) => (node.kind === 'text' ? [node] : [node, ...walk(node.children)]));

const elementsOf = (nodes: readonly CleanNode[]) =>
  walk(nodes).filter((node) => node.kind === 'element');

describe('a chapter with script, handlers, frames and forms', () => {
  it('keeps its words, and nothing that runs or reaches out', async () => {
    const book = await openEpub(EPUBS['script.epub'] as Uint8Array, inflateRaw);
    if (isRefusal(book)) throw new Error(book.detail);
    const read = await book.chapter(0);
    if (isRefusal(read)) throw new Error(read.detail);
    const elements = elementsOf(read.nodes);
    expect(elements.every((node) => KEPT.has(node.name))).toBe(true);
    for (const node of elements) {
      expect(
        Object.keys(node.attrs).every((key) =>
          ['align', 'title', 'href', 'src', 'alt'].includes(key),
        ),
      ).toBe(true);
    }
    const names = elements.map((node) => node.name);
    for (const gone of ['script', 'iframe', 'object', 'form', 'input', 'button', 'style', 'svg']) {
      expect(names).not.toContain(gone);
    }
    // No link runs: the web's alone keeps its address, for the system's browser (#40, Phase 2b);
    // the remote picture is its words.
    expect(
      elements.filter((node) => node.attrs.href !== undefined).map((node) => node.attrs.href),
    ).toEqual(['https://example.com/']);
    expect(read.images).toEqual([]);
    const words = plainOf(read.nodes);
    expect(words).toContain('A link that runs');
    expect(words).toContain('[A remote picture]');
    expect(words).not.toContain('eienRan');
    expect(words).not.toContain('display: none');
  });
});

describe('a chapter’s pictures and addresses', () => {
  const holds = (name: string) => ['OEBPS/images/a.png', 'OEBPS/text/b.png'].includes(name);
  const chapter = (body: string) =>
    chapterOf(new TextEncoder().encode(body), 'OEBPS/text/chapter.xhtml', holds);

  it('shows a picture only from the zip, in a format notes show', () => {
    const read = chapter(`
      <img src="../images/a.png" alt="in the zip"/>
      <img src="b.png" alt="beside"/>
      <img src="../../../etc/passwd.png" alt="above the zip"/>
      <img src="/OEBPS/images/a.png" alt="from the root"/>
      <img src="https://example.com/a.png" alt="the web"/>
      <img src="data:image/png;base64,AAAA" alt="data"/>
      <img src="javascript:alert(1)" alt="script"/>
      <img src="../images/missing.png" alt="missing"/>
      <img src="chapter.xhtml" alt="not a picture"/>`);
    expect(read.images).toEqual(['OEBPS/images/a.png', 'OEBPS/text/b.png']);
    const words = plainOf(read.nodes);
    for (const alt of ['above the zip', 'the web', 'data', 'script', 'missing', 'not a picture']) {
      expect(words).toContain(`[${alt}]`);
    }
  });

  it('keeps a link’s words, wherever it goes; an address only to the web, mail or the book', () => {
    const read = chapter(
      '<p><a href="#note1">1</a> <a href="https://example.com">web</a> <a href="javascript:x()">run</a> <a href="mailto:a@b.c">mail</a></p>',
    );
    expect(
      elementsOf(read.nodes)
        .filter((node) => node.attrs.href !== undefined)
        .map((node) => node.attrs.href),
      // A place in the chapter only once the spine says it's a chapter (./links.test.ts).
    ).toEqual(['https://example.com', 'mailto:a@b.c']);
    expect(plainOf(read.nodes).trim()).toBe('1 web run mail');
  });

  it('survives deep nesting and malformed markup', () => {
    const deep = `${'<div><span>'.repeat(3000)}deep${'</span></div>'.repeat(3000)}`;
    expect(plainOf(chapter(deep).nodes)).toContain('deep');
    expect(plainOf(chapter('<p>Unclosed <em>words <p>and <<<>>> more</b></i>').nodes)).toContain(
      'and',
    );
    expect(chapter('').nodes).toEqual([]);
  });

  it('reads bytes that aren’t UTF-8 as replacement characters, never a throw', () => {
    const read = chapterOf(
      new Uint8Array([0x3c, 0x70, 0x3e, 0xff, 0xfe, 0xc3]),
      'a.xhtml',
      () => false,
    );
    expect(plainOf(read.nodes)).toBe('\n���\n');
  });
});

describe('a book too large', () => {
  it('refuses a chapter past the text cap, the rest of the book still read', async () => {
    const { utf8 } = await import('../export/zip');
    const caps = { ...EPUB_CAPS, text: 4096 };
    const opf = `<package><manifest><item id="n" href="nav.xhtml" properties="nav" media-type="application/xhtml+xml"/><item id="a" href="a.xhtml" media-type="application/xhtml+xml"/><item id="b" href="b.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="a"/><itemref idref="b"/></spine></package>`;
    const nav =
      '<nav epub:type="toc"><ol><li><a href="a.xhtml">A</a></li><li><a href="b.xhtml">B</a></li></ol></nav>';
    const bytes = handZip([
      { name: 'META-INF/container.xml', data: '<rootfile full-path="c.opf"/>' },
      { name: 'c.opf', data: opf },
      { name: 'nav.xhtml', data: nav },
      { name: 'a.xhtml', data: '<p>Small.</p>', method: 8 },
      { name: 'b.xhtml', data: utf8(`<p>${'x'.repeat(caps.text)}</p>`), method: 8 },
    ]);
    const epub = await openEpub(bytes, inflateRaw, caps);
    if (isRefusal(epub)) throw new Error(epub.detail);
    expect(await epub.chapter(0)).toMatchObject({ images: [] });
    expect(await epub.chapter(1)).toMatchObject({ refused: 'too-large' });
  });

  it('refuses entries over the total, every one pointing at the same data', () => {
    // A bomb by total: many directory entries sharing one stream, each within the ratio.
    const stored = 70 * 1024;
    const size = stored * 90;
    const count = Math.ceil(EPUB_CAPS.total / size) + 1;
    const one = handZip([{ name: 'kernel', data: new Uint8Array(stored) }]);
    const local = one.subarray(0, 30 + 'kernel'.length + stored);
    const central: number[] = [];
    for (let n = 0; n < count; n++) {
      const name = new TextEncoder().encode(`entry-${n}`);
      const head = new DataView(new ArrayBuffer(46));
      head.setUint32(0, 0x0201_4b50, true);
      head.setUint16(10, 8, true);
      head.setUint32(20, stored, true);
      head.setUint32(24, size, true);
      head.setUint16(28, name.length, true);
      central.push(...new Uint8Array(head.buffer), ...name);
    }
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x0605_4b50, true);
    end.setUint16(8, count, true);
    end.setUint16(10, count, true);
    end.setUint32(12, central.length, true);
    end.setUint32(16, local.length, true);
    const bytes = new Uint8Array([...local, ...central, ...new Uint8Array(end.buffer)]);
    expect(openZip(bytes, inflateRaw)).toMatchObject({ refused: 'too-large' });
  });
});
