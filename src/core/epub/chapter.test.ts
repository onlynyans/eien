import { describe, expect, it } from 'vitest';
import { type CleanNode, type HtmlElement, plainOf } from '../html';
import { chapterOf } from './chapter';
import { markFirstLine } from './first-line';
import { unwrapSvgPlates } from './svg-plate';

const read = (body: string, holds: (name: string) => boolean = () => true) =>
  chapterOf(new TextEncoder().encode(body), 'text/chapter.xhtml', holds);

const parts = (nodes: readonly CleanNode[]): string[] =>
  nodes.flatMap((node) =>
    node.kind === 'text'
      ? []
      : [...(node.part ? [`${node.name}:${node.part}`] : []), ...parts(node.children)],
  );

describe('the book’s parts', () => {
  it('names a chapter’s title by its heading, its class or its epub:type', () => {
    expect(parts(read('<h1>I</h1><h2>II</h2><h3>Not a title</h3>').nodes)).toEqual([
      'h1:chapter-title',
      'h2:chapter-title',
    ]);
    expect(
      parts(read('<p class="chapter-head">I</p><div epub:type="title">II</div>').nodes),
    ).toEqual(['p:chapter-title', 'div:chapter-title']);
  });

  it('names scene breaks, epigraphs and captions by what the publisher called them', () => {
    expect(
      parts(
        read(
          '<hr/><p class="scene-break">* * *</p><div class="asterism">⁂</div><blockquote epub:type="epigraph">Words</blockquote><p class="caption">A caption</p>',
        ).nodes,
      ),
    ).toEqual([
      'hr:scene-break',
      'p:scene-break',
      'div:scene-break',
      'blockquote:epigraph',
      'p:caption',
    ]);
  });

  it('names a block holding only a picture a plate, and not one with words beside it', () => {
    expect(parts(read('<p><a href="#x"><img src="a.png"/></a></p>').nodes)).toEqual(['p:plate']);
    expect(parts(read('<p><img src="a.png"/> and words</p>').nodes)).toEqual([]);
    expect(parts(read('<p><img src="a.png"/><img src="b.png"/></p>').nodes)).toEqual([]);
  });

  it('names nothing a plain chapter doesn’t have', () => {
    expect(parts(read('<p>Words.</p><p>More words.</p>').nodes)).toEqual([]);
  });
});

describe('markFirstLine', () => {
  it('names the first paragraph with words after the title, once', () => {
    expect(parts(read('<h1>I</h1><p> </p><p>It is a truth…</p><p>However…</p>').nodes)).toEqual([
      'h1:chapter-title',
      'p:first-line',
    ]);
  });

  it('never finds it in an epigraph or a caption', () => {
    expect(
      parts(
        read('<h1>I</h1><blockquote class="epigraph"><p>Motto</p></blockquote><p>Real first</p>')
          .nodes,
      ),
    ).toEqual(['h1:chapter-title', 'blockquote:epigraph', 'p:first-line']);
    const caption = read(
      '<h1>I</h1><div class="caption"><p>Under a plate</p></div><p>Real first</p>',
    );
    expect(parts(caption.nodes)).toEqual(['h1:chapter-title', 'div:caption', 'p:first-line']);
  });

  it('finds it inside the section that holds it, and names none with no title', () => {
    expect(parts(read('<div><h2>I</h2><div><p>First.</p></div></div>').nodes)).toEqual([
      'h2:chapter-title',
      'p:first-line',
    ]);
    expect(parts(read('<p>No title here.</p>').nodes)).toEqual([]);
    expect(markFirstLine([])).toEqual([]);
  });
});

describe('unwrapSvgPlates', () => {
  const svg = (inner: string, label = ''): HtmlElement => ({
    kind: 'element' as const,
    name: 'svg',
    attrs: label ? { 'aria-label': label } : ({} as Record<string, string>),
    children: [
      { kind: 'element' as const, name: 'g', attrs: {}, children: inner ? [image(inner)] : [] },
    ],
  });
  const image = (href: string): HtmlElement => ({
    kind: 'element' as const,
    name: 'image',
    attrs: { 'xlink:href': href },
    children: [],
  });

  it('turns a frame round one picture into an <img>, its label the alt', () => {
    expect(unwrapSvgPlates([svg('cover.jpg', 'The cover')])).toEqual([
      { kind: 'element', name: 'img', attrs: { src: 'cover.jpg', alt: 'The cover' }, children: [] },
    ]);
  });

  it('leaves a drawing an SVG, which the cleaner drops', () => {
    const drawing = { ...svg(''), children: [image('a.png'), image('b.png')] };
    expect(unwrapSvgPlates([drawing])).toEqual([drawing]);
    expect(
      read('<svg><image href="a.png"/><image href="b.png"/></svg><p>After</p>').images,
    ).toEqual([]);
  });

  it('shows the picture only if the zip holds it', () => {
    const framed = '<div><svg><image xlink:href="../images/a.jpg"/></svg></div>';
    expect(read(framed).images).toEqual(['images/a.jpg']);
    expect(read(framed, () => false).images).toEqual([]);
  });
});

describe('names with a prefix', () => {
  it('drops a prefixed script or style, and unwraps a prefixed SVG frame', () => {
    const chapter = read(
      '<p>Words</p><html:script>window.ran = 1</html:script><svg:style>p{x}</svg:style><svg:svg><svg:image xlink:href="a.png"/></svg:svg>',
    );
    expect(plainOf(chapter.nodes)).not.toMatch(/ran|p\{x\}/u);
    expect(chapter.images).toEqual(['text/a.png']);
  });
});
