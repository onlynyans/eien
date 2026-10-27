import { describe, expect, it } from 'vitest';
import { type CleanNode, cleanHtml, plainOf } from './clean';

/** Cleaned nodes written back as tags, so a test reads what the reader would draw. */
function shown(nodes: readonly CleanNode[]): string {
  return nodes
    .map((node) => {
      if (node.kind === 'text') return node.text;
      const attrs = Object.entries(node.attrs)
        .map(([name, value]) => ` ${name}="${value}"`)
        .join('');
      return `<${node.name}${attrs}>${shown(node.children)}</${node.name}>`;
    })
    .join('');
}

const clean = (html: string) => shown(cleanHtml(html));

describe('cleanHtml: what a story looks like', () => {
  it('keeps paragraphs, emphasis, scene breaks and quotes', () => {
    expect(
      clean('<p>She <em>ran</em>, <strong>fast</strong>.</p><hr><blockquote><p>Q</p></blockquote>'),
    ).toBe(
      '<p>She <em>ran</em>, <strong>fast</strong>.</p><hr></hr><blockquote><p>Q</p></blockquote>',
    );
  });

  it('turns a style into the tag it means, as a paste does', () => {
    expect(clean('<p><span style="font-style: italic">soft</span></p>')).toBe(
      '<p><em>soft</em></p>',
    );
  });

  it('keeps where a block sits, from align, text-align or <center>', () => {
    expect(clean('<p align="center">*</p>')).toBe('<p align="center">*</p>');
    expect(clean('<p style="text-align: RIGHT">x</p>')).toBe('<p align="right">x</p>');
    expect(clean('<center>end</center>')).toBe('<div align="center">end</div>');
    expect(clean('<p align="middle">x</p>')).toBe('<p>x</p>');
  });

  it('leaves out AO3’s landmark headings, there for screen readers', () => {
    expect(clean('<h3 class="landmark heading">Chapter Text</h3><p>Words</p>')).toBe(
      '<p>Words</p>',
    );
  });

  it('keeps an element it doesn’t know as its words', () => {
    expect(clean('<p><span class="x"><font color="red">red</font></span></p>')).toBe('<p>red</p>');
  });
});

describe('cleanHtml: nothing of the page runs or leaks', () => {
  it('drops scripts, styles and controls with what they hold', () => {
    expect(
      clean('<p>a<script>alert(1)</script><style>p{}</style><button>Kudos</button>b</p>'),
    ).toBe('<p>ab</p>');
  });

  it('keeps no handler, class, id or style', () => {
    expect(clean('<p id="x" class="y" style="color:red" onclick="steal()">t</p>')).toBe('<p>t</p>');
  });

  it('keeps links to the web and to mail, and only words for the rest', () => {
    expect(clean('<a href="https://ao3.org/works/1" target="_top">w</a>')).toBe(
      '<a href="https://ao3.org/works/1">w</a>',
    );
    expect(clean('<a href="mailto:a@b.c">m</a>')).toBe('<a href="mailto:a@b.c">m</a>');
    expect(clean('<a href="java\tscript:alert(1)">j</a>')).toBe('<a>j</a>');
    expect(clean('<a href="/works/1">r</a>')).toBe('<a>r</a>');
    expect(clean('<a href="data:text/html,x">d</a>')).toBe('<a>d</a>');
  });

  it('shows an image from https, and only its words from anywhere else', () => {
    expect(clean('<img src="https://i.example/a.png" alt="A map" width="900" onerror="x()">')).toBe(
      '<img src="https://i.example/a.png" alt="A map"></img>',
    );
    expect(clean('<p><img src="http://i.example/a.png" alt="A map"></p>')).toBe('<p>[A map]</p>');
    expect(clean('<img src="javascript:x()">')).toBe('');
  });

  it('drops frames, embeds and drawings', () => {
    expect(clean('<iframe src="https://e.x"></iframe><svg><text>s</text></svg><p>k</p>')).toBe(
      '<p>k</p>',
    );
  });
});

describe('plainOf', () => {
  it('parts blocks with a line, so their words are counted apart', () => {
    expect(
      plainOf(cleanHtml('<p>one</p><p>two<br>three</p>')).split(/\s+/u).filter(Boolean),
    ).toEqual(['one', 'two', 'three']);
  });
});
