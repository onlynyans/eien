// Adversarial: images in a book's exports (spec §8). In Word a picture is
// "sized to fit" the page; in an EPUB every page is sound XHTML; a footnote's
// mark is never lost. Each test here fails on the code as it stands.

import { describe, expect, it } from 'vitest';
import { png } from '../../../tests/support/images';
import { readZip } from '../../../tests/support/read-zip';
import { assertSoundXhtml } from '../../../tests/support/xml-check';
import type { ExportRequest } from './book';
import type { ExportImage } from './chapter';
import { docx } from './docx';
import { epub } from './epub';
import { imageInfo } from './images';

const image = (key: string, bytes: Uint8Array): ExportImage => {
  const info = imageInfo(bytes);
  if (!info) throw new Error('not an image');
  return { key, bytes, info };
};

/** 2000 px at 96 an inch: wider than letter's 6.5 in of text, so drawn at the text's width. */
const WIDE = image('wide.png', png(2000, 500));
const SCARF = image('scarf.png', png(40, 30));

const request = (markdown: string, images: ReadonlyMap<string, ExportImage>): ExportRequest => ({
  title: 'One',
  notes: [{ title: 'One', markdown, images }],
  book: false,
  quotes: 'straight',
  language: 'en-US', // letter: 12240 twips wide, 1440 a side for the margins
  key: 'k',
  date: new Date(0),
});

/** Letter's text width in twips (a twip is 635 EMU). */
const TEXT_TWIPS = 12240 - 2 * 1440;
const EMU_PER_TWIP = 635;

const extentOf = (xml: string): number => {
  const cx = /<wp:extent cx="(\d+)"/u.exec(xml)?.[1];
  if (cx === undefined) throw new Error('no picture');
  return Number(cx);
};

describe('Word: a picture is no wider than the room it is drawn in', () => {
  it('in a table, each picture fits its own cell, not the whole page', () => {
    const markdown =
      '| a | b | c |\n|---|---|---|\n| ![x](wide.png) | ![y](wide.png) | ![z](wide.png) |';
    const document = readZip(docx(request(markdown, new Map([['wide.png', WIDE]])))).text(
      'word/document.xml',
    );
    const cells = [...document.matchAll(/<w:tc>([\s\S]*?)<\/w:tc>/gu)]
      .map((match) => match[1] as string)
      .filter((cell) => cell.includes('<w:drawing>'));
    expect(cells).toHaveLength(3);
    for (const cell of cells) {
      const width = Number(/<w:tcW w:w="(\d+)"/u.exec(cell)?.[1]);
      // Today each is drawn 6.5 in wide in a 2 in cell: the row is three pages wide.
      expect(extentOf(cell)).toBeLessThanOrEqual(width * EMU_PER_TWIP);
    }
  });

  it('in a list three deep, the picture stays on the paper', () => {
    const markdown = '- One\n  - Two\n    - ![deep](wide.png)';
    const document = readZip(docx(request(markdown, new Map([['wide.png', WIDE]])))).text(
      'word/document.xml',
    );
    const item = /<w:p>(?:(?!<w:p>)[\s\S])*?<w:drawing>[\s\S]*?<\/w:p>/u.exec(document)?.[0] ?? '';
    expect(item).toContain('<w:ilvl w:val="2"/>'); // the third level: indented 2160 twips
    // Drawn 6.5 in wide from 1.5 in in: it ends 0.5 in past the paper's edge.
    expect(extentOf(item)).toBeLessThanOrEqual((TEXT_TWIPS - 2160) * EMU_PER_TWIP);
  });

  it('in a quote, the picture stays within the quote’s indents', () => {
    const markdown = '> ![quoted](wide.png)';
    const document = readZip(docx(request(markdown, new Map([['wide.png', WIDE]])))).text(
      'word/document.xml',
    );
    const quote = /<w:p><w:pPr><w:pStyle w:val="Quote"\/>[\s\S]*?<\/w:p>/u.exec(document)?.[0];
    // The Quote style is indented 720 twips on each side.
    expect(extentOf(quote ?? '')).toBeLessThanOrEqual((TEXT_TWIPS - 2 * 720) * EMU_PER_TWIP);
  });
});

describe('EPUB: images keep the page sound', () => {
  it('an image with no description, linked to the web, leaves no link without words', () => {
    // Obsidian writes images as ![](file): linked, the EPUB's link holds only an empty picture.
    const markdown = '[![](scarf.png)](https://example.org/scarf)';
    const zip = readZip(epub(request(markdown, new Map([['scarf.png', SCARF]]))));
    const chapter = zip.text('OEBPS/chapter-1.xhtml');
    expect(chapter).toContain('images/image-1.png'); // carried
    expect(() => assertSoundXhtml(chapter)).not.toThrow();
  });

  it('a footnote’s mark in an image’s description is kept, and leads to its note', () => {
    const markdown = 'Text ![A scarf[^1]](scarf.png) after.\n\n[^1]: Knitted by hand.';
    const zip = readZip(epub(request(markdown, new Map([['scarf.png', SCARF]]))));
    const chapter = zip.text('OEBPS/chapter-1.xhtml');
    assertSoundXhtml(chapter);
    // Today the mark becomes U+F0001 inside alt="", and the note is shown as one nothing leads to.
    expect(chapter).not.toMatch(/\p{Co}/u);
    expect(chapter).toContain('<aside epub:type="footnote" id="fn1">');
  });
});
