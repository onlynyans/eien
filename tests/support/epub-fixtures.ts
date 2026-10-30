// The fixture books (#40), the same bytes each time: Pride and Prejudice's
// first three chapters (Jane Austen, 1813) with two of Hugh Thomson's 1894
// illustrations (tests/fixtures/epub/source/). Eien's own EPUB writer makes
// the plain book; the rest are made by hand (./epub-zip.ts), each for a case
// a reader meets: EPUB 2's NCX, EPUB 3's page-list, pictures alone, framed
// in SVG and captioned, and the hostile ones. scripts/epub-fixtures.mjs
// writes them to tests/fixtures/epub/, and a test holds them to this.

import { epub } from '../../src/core/export/epub';
import { imageInfo } from '../../src/core/export/images';
import { hostileEpubs } from './epub-hostile';
import { noteEpubs } from './epub-notes';
import {
  escaped,
  handEpub,
  type Item,
  nav,
  opf,
  page,
  paragraphs,
  TITLE,
  XHTML,
} from './epub-parts';
import { JPEG } from './images';

export interface EpubSources {
  /** Each chapter's paragraphs. */
  readonly chapters: readonly (readonly string[])[];
  /** "He rode a black horse." (Chapter III) and Chapter II's headpiece. */
  readonly plate: Uint8Array;
  readonly headpiece: Uint8Array;
}

export { TITLE } from './epub-parts';

/**
 * The same books in small, for core's tests, which can't read the disk: a few
 * of each chapter's lines, and a one-pixel picture for both of Thomson's.
 */
export const SAMPLE_SOURCES: EpubSources = {
  chapters: [
    [
      'It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.',
      'However little known the feelings or views of such a man may be on his first entering a neighbourhood…',
      '“My dear Mr. Bennet,” said his lady to him one day, “have you heard that Netherfield Park is let at last?”',
      'Mr. Bennet replied that he had not.',
      '“But it is,” returned she.',
    ],
    ['Mr. Bennet was among the earliest of those who waited on Mr. Bingley.'],
    [
      'Not all that Mrs. Bennet, however, with the assistance of her five daughters, could ask on the subject, was sufficient to draw from her husband any satisfactory description of Mr. Bingley.',
      'Sir William had been delighted with him.',
      'In a few days Mr. Bingley returned Mr. Bennet’s visit.',
    ],
  ],
  plate: JPEG,
  headpiece: JPEG,
};
const ROMAN = ['I', 'II', 'III'];
const PLATE_WORDS = 'He rode a black horse.';

const chapterPage = (n: number, paras: readonly string[], extra = '') =>
  page(
    `Chapter ${ROMAN[n]}`,
    `<section epub:type="chapter"><h2 class="chapter-title">Chapter ${ROMAN[n]}.</h2>\n${extra}${paragraphs(paras)}</section>`,
  );
const chapterItems = (count: number): Item[] =>
  Array.from({ length: count }, (_, n) => ({
    id: `c${n + 1}`,
    href: `text/chapter-${n + 1}.xhtml`,
    type: XHTML,
  }));

const chapterRows = (count: number): [string, string][] =>
  Array.from({ length: count }, (_, n) => [`Chapter ${ROMAN[n]}`, `chapter-${n + 1}.xhtml`]);

function plain(sources: EpubSources): Uint8Array {
  const image = (bytes: Uint8Array, key: string) => {
    const info = imageInfo(bytes);
    if (!info) throw new Error(`${key} isn’t an image`);
    return { key, bytes, info };
  };
  const [one = [], two = [], three = []] = sources.chapters;
  return epub({
    title: TITLE,
    book: true,
    quotes: 'curly',
    language: 'en',
    key: 'fixture:plain',
    date: new Date(Date.UTC(2026, 9, 28)),
    notes: [
      { title: 'Chapter I', markdown: one.join('\n\n') },
      {
        title: 'Chapter II',
        markdown: `![](headpiece.jpg)\n\n${two.join('\n\n')}`,
        images: new Map([['headpiece.jpg', image(sources.headpiece, 'headpiece')]]),
      },
      {
        title: 'Chapter III',
        markdown: `${three.slice(0, 2).join('\n\n')}\n\n![${PLATE_WORDS}](black-horse.jpg)\n\n${three.slice(2).join('\n\n')}`,
        images: new Map([['black-horse.jpg', image(sources.plate, 'plate')]]),
      },
    ],
  });
}

/** EPUB 2: the NCX alone, a part holding the chapters, and the print edition's pages. */
function epub2(sources: EpubSources): Uint8Array {
  const point = (id: string, title: string, src: string, inner = '') =>
    `<navPoint id="${id}"><navLabel><text>${escaped(title)}</text></navLabel><content src="${src}"/>${inner}</navPoint>`;
  const ncx = `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
<head><meta name="dtb:uid" content="urn:eien:fixture:2.0"/></head>
<docTitle><text>${TITLE}</text></docTitle>
<navMap>${point(
    'part',
    'Volume I',
    'text/chapter-1.xhtml',
    sources.chapters
      .map((_, n) => point(`p${n}`, `Chapter ${ROMAN[n]}`, `text/chapter-${n + 1}.xhtml`))
      .join(''),
  )}</navMap>
<pageList>${sources.chapters
    .map(
      (_, n) =>
        `<pageTarget id="pg${n + 1}" type="normal" value="${n + 1}"><navLabel><text>${n + 1}</text></navLabel><content src="text/chapter-${n + 1}.xhtml"/></pageTarget>`,
    )
    .join('')}</pageList>
</ncx>`;
  const items = [
    ...chapterItems(sources.chapters.length),
    { id: 'ncx', href: 'toc.ncx', type: 'application/x-dtbncx+xml' },
  ];
  return handEpub('OEBPS/content.opf', [
    {
      name: 'OEBPS/content.opf',
      data: opf(
        '2.0',
        items,
        items.slice(0, -1).map((i) => i.id),
        'ncx',
      ),
      descriptor: true,
    },
    { name: 'OEBPS/toc.ncx', data: ncx, descriptor: true },
    ...sources.chapters.map((paras, n) => ({
      name: `OEBPS/text/chapter-${n + 1}.xhtml`,
      data: chapterPage(n, paras),
      descriptor: true,
    })),
  ]);
}

/** EPUB 3 with the printed edition's pages in its nav. */
function pageList(sources: EpubSources): Uint8Array {
  const count = sources.chapters.length;
  const items = [
    { id: 'nav', href: 'text/nav.xhtml', type: XHTML, properties: 'nav' },
    ...chapterItems(count),
  ];
  const pages: [string, string][] = Array.from({ length: count * 2 }, (_, i) => [
    String(i + 1),
    `chapter-${Math.floor(i / 2) + 1}.xhtml#page-${i + 1}`,
  ]);
  return handEpub('OEBPS/package.opf', [
    {
      name: 'OEBPS/package.opf',
      data: opf(
        '3.0',
        items,
        items.slice(1).map((i) => i.id),
      ),
    },
    { name: 'OEBPS/text/nav.xhtml', data: nav(chapterRows(count), pages) },
    ...sources.chapters.map((paras, n) => ({
      name: `OEBPS/text/chapter-${n + 1}.xhtml`,
      data: chapterPage(
        n,
        paras,
        `<span epub:type="pagebreak" id="page-${2 * n + 1}" title="${2 * n + 1}"/>`,
      ),
    })),
  ]);
}

/** Pictures: a chapter that's only a plate, Calibre's SVG frame, and a captioned figure. */
function plates(sources: EpubSources): Uint8Array {
  const [one = []] = sources.chapters;
  const items = [
    { id: 'nav', href: 'nav.xhtml', type: XHTML, properties: 'nav' },
    { id: 'plate', href: 'plate.xhtml', type: XHTML },
    { id: 'framed', href: 'framed.xhtml', type: XHTML },
    { id: 'figure', href: 'figure.xhtml', type: XHTML },
    { id: 'p1', href: 'images/black-horse.jpg', type: 'image/jpeg' },
    { id: 'p2', href: 'images/headpiece.jpg', type: 'image/jpeg' },
  ];
  const svg = `<div class="calibre"><svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="100%" height="100%" viewBox="0 0 360 260" preserveAspectRatio="xMidYMid meet" aria-label="Chapter II’s headpiece"><image width="360" height="260" xlink:href="images/headpiece.jpg"/></svg></div>`;
  return handEpub('content.opf', [
    { name: 'content.opf', data: opf('3.0', items, ['plate', 'framed', 'figure']) },
    {
      name: 'nav.xhtml',
      data: nav([
        ['The black horse', 'plate.xhtml'],
        ['Chapter II’s headpiece', 'framed.xhtml'],
        ['Chapter I, with a figure', 'figure.xhtml'],
      ]),
    },
    {
      name: 'plate.xhtml',
      data: page(
        'Plate',
        `<div class="plate"><img src="images/black-horse.jpg" alt="${PLATE_WORDS}"/></div>`,
      ),
    },
    { name: 'framed.xhtml', data: page('Headpiece', svg) },
    {
      name: 'figure.xhtml',
      data: page(
        'Chapter I',
        `<h1>Chapter I.</h1>\n<figure><img src="images/black-horse.jpg" alt=""/><figcaption>${PLATE_WORDS}</figcaption></figure>\n${paragraphs(one.slice(0, 3))}\n<hr class="transition"/>\n${paragraphs(one.slice(3, 5))}`,
      ),
    },
    { name: 'images/black-horse.jpg', data: sources.plate, method: 0 },
    { name: 'images/headpiece.jpg', data: sources.headpiece, method: 0 },
  ]);
}

/** Every fixture book, by its file's name. */
export function fixtureEpubs(sources: EpubSources): Record<string, Uint8Array> {
  return {
    'plain.epub': plain(sources),
    'epub2.epub': epub2(sources),
    'page-list.epub': pageList(sources),
    'plates.epub': plates(sources),
    ...noteEpubs(sources),
    ...hostileEpubs(sources),
  };
}

/**
 * The chapters' paragraphs from the explorations' own copy (_src/epub-text.js),
 * read, never run: each chapter an array of one-line, single-quoted strings.
 */
export function chaptersOf(source: string): string[][] {
  const chapters: string[][] = [];
  for (const line of source.slice(source.indexOf('const BOOK_TEXT')).split(/\r?\n/u)) {
    if (/^ {2}\[$/u.test(line)) chapters.push([]);
    const para = /^ {4}'(.*)',$/u.exec(line)?.[1];
    if (para !== undefined) chapters.at(-1)?.push(para);
    if (/^\];$/u.test(line)) break;
  }
  return chapters;
}
