// The fixture books with links and notes (#40, Phase 2b): Eien's own EPUB
// writer's footnotes (EPUB 3: epub:type noteref and footnote), and a book
// made by hand as EPUB 2 books are (an endnotes file, its marks numbers in a
// sup, no epub:type), with a link between chapters and a place named by an
// empty span. The hostile one is ./epub-hostile.ts's.

import { epub } from '../../src/core/export/epub';
import type { EpubSources } from './epub-fixtures';
import {
  escaped,
  handEpub,
  nav,
  oneChapter,
  opf,
  page,
  paragraphs,
  TITLE,
  XHTML,
} from './epub-parts';

/** Chapter I with two footnotes, as Eien's own export writes them. */
function notes(sources: EpubSources): Uint8Array {
  const [one = []] = sources.chapters;
  return epub({
    title: TITLE,
    book: true,
    quotes: 'curly',
    language: 'en',
    key: 'fixture:notes',
    date: new Date(Date.UTC(2026, 9, 29)),
    notes: [
      {
        title: 'Chapter I',
        markdown: `${one[0]}[^truth]\n\n${one.slice(1, 4).join('\n\n')}[^let]\n\n${one.slice(4).join('\n\n')}\n\n[^truth]: The novel’s first sentence, and its most quoted.\n\n[^let]: Netherfield Park, let to Mr. Bingley.`,
      },
    ],
  });
}

/** EPUB 2's way: an endnotes file, marks as numbers in a sup, a link between chapters, a span's place. */
function links(sources: EpubSources): Uint8Array {
  const [one = [], two = [], three = []] = sources.chapters;
  const items = [
    { id: 'c1', href: 'text/chapter-1.xhtml', type: XHTML },
    { id: 'c2', href: 'text/chapter-2.xhtml', type: XHTML },
    { id: 'c3', href: 'text/chapter-3.xhtml', type: XHTML },
    { id: 'notes', href: 'text/endnotes.xhtml', type: XHTML },
    { id: 'nav', href: 'nav.xhtml', type: XHTML, properties: 'nav' },
  ];
  const [first = '', ...rest] = one;
  const [sirBefore = [], sirAfter = []] = [three.slice(0, 1), three.slice(1)];
  return handEpub('OEBPS/content.opf', [
    { name: 'OEBPS/content.opf', data: opf('2.0', items, ['c1', 'c2', 'c3', 'notes']) },
    {
      name: 'OEBPS/nav.xhtml',
      data: nav([
        ['Chapter I', 'text/chapter-1.xhtml'],
        ['Chapter II', 'text/chapter-2.xhtml'],
        ['Chapter III', 'text/chapter-3.xhtml'],
        ['Notes', 'text/endnotes.xhtml'],
      ]),
    },
    {
      name: 'OEBPS/text/chapter-1.xhtml',
      data: page(
        'Chapter I',
        `<h2>Chapter I.</h2>\n<p>${escaped(first)}<sup><a href="endnotes.xhtml#n1" id="r1">1</a></sup></p>\n${paragraphs(rest.slice(0, 3))}\n<p>Of Sir William, <a href="chapter-3.xhtml#sir-william">see Chapter III</a>.</p>\n${paragraphs(rest.slice(3))}`,
      ),
    },
    {
      name: 'OEBPS/text/chapter-2.xhtml',
      data: page('Chapter II', `<h2>Chapter II.</h2>\n${paragraphs(two)}`),
    },
    {
      name: 'OEBPS/text/chapter-3.xhtml',
      data: page(
        'Chapter III',
        `<h2>Chapter III.</h2>\n${paragraphs(sirBefore)}\n<span id="sir-william"/>${paragraphs(sirAfter)}`,
      ),
    },
    {
      name: 'OEBPS/text/endnotes.xhtml',
      data: page(
        'Notes',
        `<h2>Notes</h2>\n<p id="n1"><a href="chapter-1.xhtml#r1">1.</a> The novel’s first sentence, and its most quoted.</p>`,
      ),
    },
  ]);
}

/** Every fixture book with links and notes, by its file's name. */
export const noteEpubs = (sources: EpubSources): Record<string, Uint8Array> => ({
  'notes.epub': notes(sources),
  'links.epub': links(sources),
});
