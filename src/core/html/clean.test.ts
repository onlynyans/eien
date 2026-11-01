import { describe, expect, it } from 'vitest';
import { shown } from '../../../tests/support/clean-nodes';
import { type CleanRules, cleanHtml, plainOf } from './clean';

/** Rules that let no address through, so these tests are the cleaner's alone. */
const NONE: CleanRules = { link: () => null, image: () => null };

const clean = (html: string, rules: CleanRules = NONE) => shown(cleanHtml(html, rules));

describe('cleanHtml: what words look like', () => {
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

  it('keeps a title only where it says what a link, abbreviation or image is', () => {
    expect(clean('<p title="t"><abbr title="Sir">S.</abbr></p>')).toBe(
      '<p><abbr title="Sir">S.</abbr></p>',
    );
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

  it('drops frames, embeds and drawings', () => {
    expect(clean('<iframe src="https://e.x"></iframe><svg><text>s</text></svg><p>k</p>')).toBe(
      '<p>k</p>',
    );
  });
});

describe('cleanHtml: the caller’s addresses', () => {
  it('asks the rules where a link goes, from its href as written', () => {
    const asked: string[] = [];
    const rules: CleanRules = {
      ...NONE,
      link: (href) => {
        asked.push(href);
        return href.startsWith('#') ? href : null;
      },
    };
    expect(
      clean('<a href="#fn1">1</a><a href="ch2.xhtml">2</a><a href="">3</a><a>4</a>', rules),
    ).toBe('<a href="#fn1">1</a><a>2</a><a>3</a><a>4</a>');
    // An empty or missing href isn't asked about.
    expect(asked).toEqual(['#fn1', 'ch2.xhtml']);
  });

  it('draws an image from what its resolver gives, as an EPUB’s come from its zip', () => {
    const files = new Map([['OEBPS/images/map.png', 'blob:eien/1']]);
    const rules: CleanRules = {
      ...NONE,
      image: (src) => files.get(`OEBPS/${src.replace(/^\.\.\//u, '')}`) ?? null,
    };
    expect(clean('<img src="../images/map.png" alt="Map">', rules)).toBe(
      '<img src="blob:eien/1" alt="Map"></img>',
    );
    expect(clean('<p><img src="../images/lost.png" alt=" Lost "></p>', rules)).toBe(
      '<p>[Lost]</p>',
    );
    expect(clean('<img alt="">', rules)).toBe('');
  });

  it('asks about an image with no src as an empty one, and gives it an empty alt', () => {
    const asked: string[] = [];
    const rules: CleanRules = {
      ...NONE,
      image: (src) => {
        asked.push(src);
        return 'blob:eien/2';
      },
    };
    expect(clean('<img>', rules)).toBe('<img src="blob:eien/2" alt=""></img>');
    expect(asked).toEqual(['']);
  });
});

describe('cleanHtml: a chapter’s named parts', () => {
  const rules: CleanRules = {
    ...NONE,
    part: (source, name) => {
      const said = `${source.attrs['epub:type'] ?? ''} ${source.attrs.class ?? ''}`;
      if (/\btitle\b/u.test(said)) return 'chapter-title';
      if (/\bepigraph\b/u.test(said)) return 'epigraph';
      if (name === 'hr') return 'scene-break';
      if (name === 'figure') return 'plate';
      if (name === 'figcaption') return 'caption';
      if (/\bfirst\b/u.test(said)) return 'drop-cap';
      return /\bodd\b/u.test(said) ? 'constructor' : null;
    },
  };

  it('names what the rules read off the page, as the element is kept', () => {
    expect(
      clean(
        '<h1 epub:type="title" class="x">One</h1><blockquote class="epigraph">E</blockquote><hr>' +
          '<figure><figcaption>Map</figcaption></figure>',
        rules,
      ),
    ).toBe(
      '<h1 {chapter-title}>One</h1><blockquote {epigraph}>E</blockquote><hr {scene-break}></hr>' +
        '<figure {plate}><figcaption {caption}>Map</figcaption></figure>',
    );
  });

  it('names nothing outside the parts it knows, and never as an attribute', () => {
    expect(clean('<p class="first">I</p><p class="odd">O</p>', rules)).toBe('<p>I</p><p>O</p>');
  });

  it('loses a part with the element it was on, when that isn’t kept', () => {
    expect(clean('<p><span class="title">T</span></p>', rules)).toBe('<p>T</p>');
  });

  it('names nothing when the rules have no parts', () => {
    expect(clean('<h1 epub:type="title">One</h1>')).toBe('<h1>One</h1>');
  });
});

describe('plainOf', () => {
  it('parts blocks with a line, so their words are counted apart', () => {
    expect(
      plainOf(cleanHtml('<p>one</p><p>two<br>three</p>', NONE)).split(/\s+/u).filter(Boolean),
    ).toEqual(['one', 'two', 'three']);
  });
});
