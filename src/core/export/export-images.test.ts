// Images in a book's exports (spec §8): carried once each, at their place in
// the text, by every format; one the note doesn't carry (from the web, not
// there) is its description.

import { describe, expect, it } from 'vitest';
import { shownText, xmlParts } from '../../../tests/support/export-parts';
import { GIF, png } from '../../../tests/support/images';
import { readZip } from '../../../tests/support/read-zip';
import { assertSoundXhtml, assertWellFormedXml } from '../../../tests/support/xml-check';
import type { ExportRequest } from './book';
import type { ExportImage } from './chapter';
import { docx } from './docx';
import { epub } from './epub';
import { imageInfo } from './images';
import { printHtml } from './print-html';

const image = (key: string, bytes: Uint8Array): ExportImage => {
  const info = imageInfo(bytes);
  if (!info) throw new Error('not an image');
  return { key, bytes, info };
};

const WIDE = image('art/wide.png', png(2000, 500));
const DOT = image('art/dot.gif', GIF);

const BOOK: ExportRequest = {
  title: 'Book',
  notes: [
    {
      title: 'One',
      markdown:
        'Before ![A *wide* view](../art/wide.png) after.[^1]\n\n![gone](missing.png)\n\n[^1]: A dot: ![dot](/art/dot.gif)',
      images: new Map([
        ['../art/wide.png', WIDE],
        ['/art/dot.gif', DOT],
      ]),
    },
    // The same file by another address: carried once.
    { title: 'Two', markdown: '![again](art/wide.png)', images: new Map([['art/wide.png', WIDE]]) },
  ],
  book: true,
  quotes: 'curly',
  language: 'en-US',
  key: 'k',
  date: new Date(0),
};

describe('images in an EPUB', () => {
  const zip = readZip(epub(BOOK));
  const opf = zip.text('OEBPS/content.opf');

  it('holds each image once, listed with its media type, its bytes as they were', () => {
    expect(zip.names.filter((name) => name.startsWith('OEBPS/images/'))).toEqual([
      'OEBPS/images/image-1.png',
      'OEBPS/images/image-2.gif',
    ]);
    expect(opf).toContain('<item id="img1" href="images/image-1.png" media-type="image/png"/>');
    expect(opf).toContain('<item id="img2" href="images/image-2.gif" media-type="image/gif"/>');
    expect([...(zip.files.get('OEBPS/images/image-2.gif') ?? [])]).toEqual([...GIF]);
  });

  it('shows them where the note does, with their words; one it lacks is its description', () => {
    const one = zip.text('OEBPS/chapter-1.xhtml');
    assertSoundXhtml(one);
    expect(one).toContain('<p>Before <img src="images/image-1.png" alt="A wide view" /> after.');
    expect(one).toContain('<img src="images/image-2.gif" alt="dot" />'); // in the footnote
    expect(one).toContain('<p>gone</p>');
    expect(zip.text('OEBPS/chapter-2.xhtml')).toContain(
      '<img src="images/image-1.png" alt="again" />',
    );
  });
});

describe('images in a Word file', () => {
  const zip = readZip(docx(BOOK));
  const document = zip.text('word/document.xml');
  const footnotes = zip.text('word/footnotes.xml');

  it('keeps them in word/media, each part relating them', () => {
    expect(zip.names.filter((name) => name.startsWith('word/media/'))).toEqual([
      'word/media/image-1.png',
      'word/media/image-2.gif',
    ]);
    for (const part of ['document', 'footnotes']) {
      const rels = zip.text(`word/_rels/${part}.xml.rels`);
      expect(rels).toContain(
        'Id="rIdImage1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image-1.png"',
      );
    }
    expect(zip.text('[Content_Types].xml')).toContain(
      '<Default Extension="png" ContentType="image/png"/>',
    );
    for (const [, xml] of xmlParts(docx(BOOK))) assertWellFormedXml(xml);
  });

  it('draws each in line, made to fit the text’s width, its words as its description', () => {
    // 2000 px at 96 an inch is past 6.5 in of letter's text: drawn 6.5 in wide, a quarter as high.
    expect(document).toContain('<wp:extent cx="5943600" cy="1485900"/>');
    expect(document).toContain('descr="A wide view"');
    expect(footnotes).toContain('<wp:extent cx="9525" cy="9525"/>'); // the dot, as it is
    const ids = [...`${document}${footnotes}`.matchAll(/<wp:docPr id="(\d+)"/gu)].map((m) => m[1]);
    expect(new Set(ids).size).toBe(ids.length);
    expect(shownText(document)).toContain('gone');
  });
});

describe('images on the PDF’s page', () => {
  const html = printHtml(BOOK);

  it('holds each once, as data in its style, which its policy allows; nothing else', () => {
    expect(html).toContain(
      `content="default-src 'none'; style-src 'unsafe-inline'; img-src data:"`,
    );
    expect(html).toContain('<img class="eien-image-0" alt="A wide view" />');
    expect(html).toContain('<img class="eien-image-0" alt="again" />'); // shown again: named again
    const rules = html.match(
      /img\.eien-image-0 \{ content: url\("data:image\/png;base64,iVBORw0KGgo/gu,
    );
    expect(rules).toHaveLength(1);
    expect(html).not.toContain('eien-image:');
    expect(html).not.toMatch(/<img src=/u);
  });
});
