// EPUB 3 (spec §8), readable in Apple Books and on a Kobo: a title page
// for a book, a contents page, one XHTML file per chapter with its
// footnotes as pop-up notes at its end, and an EPUB 2 contents (toc.ncx)
// for older readers. The styles are few, so the reader's font and size win.

import { chaptersOf, type ExportRequest, languageTag, utcSeconds, uuidOf } from './book';
import type { Chapter } from './chapter';
import { escapeXml, toXhtml } from './xml';
import { zipStore } from './zip';

const CONTAINER = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
<rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>
`;

const STYLE = `body { margin: 0 5%; }
h1 { font-size: 1.5em; font-weight: normal; text-align: center; margin: 3em 0 2em; page-break-after: avoid; }
h2, h3, h4, h5, h6 { font-size: 1.1em; margin: 1.5em 0 0.5em; page-break-after: avoid; }
p { margin: 0; text-indent: 1.5em; }
h1 + p, h2 + p, h3 + p, h4 + p, h5 + p, h6 + p, .scene-break + p, blockquote p, li p, aside p { text-indent: 0; }
.scene-break { margin: 1em 0; text-align: center; text-indent: 0; }
blockquote { margin: 1em 1.5em; }
pre { white-space: pre-wrap; font-size: 0.85em; }
table { border-collapse: collapse; margin: 1em 0; }
td, th { border: 1px solid; padding: 0.2em 0.4em; }
.title-page { text-align: center; margin-top: 30%; }
.title-page h1 { font-size: 2em; }
.footnotes { margin-top: 2em; font-size: 0.9em; }
`;

const page = (
  language: string,
  title: string,
  body: string,
) => `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${language}" lang="${language}">
<head>
<meta charset="UTF-8"/>
<title>${escapeXml(title)}</title>
<link rel="stylesheet" type="text/css" href="style.css"/>
</head>
<body>
${body}
</body>
</html>
`;

const chapterFile = (n: number) => `chapter-${n}.xhtml`;

/** A chapter's page: its heading, its blocks, then its notes, each linking back to its mark. */
function chapterBody(chapter: Chapter): string {
  const notes = chapter.notes.map(({ blocks, referred }, i) => {
    const n = i + 1;
    const back = referred ? `<a href="#fnref${n}">${n}.</a> ` : `${n}. `;
    const [first = '', ...rest] = blocks;
    const opened = first.startsWith('<p>')
      ? `<p>${back}${first.slice(3)}`
      : `<p>${back}</p>${first}`;
    // A reader keeps a footnote out of the flow, to pop up from its mark: one with no mark stays in it.
    const tag = referred ? 'aside epub:type="footnote"' : 'div class="note"';
    return `<${tag} id="fn${n}">\n${[opened, ...rest].join('\n')}\n</${tag.split(' ')[0]}>`;
  });
  const parts = [
    `<section epub:type="chapter">`,
    `<h1>${chapter.heading}</h1>`,
    ...chapter.blocks,
    ...(notes.length
      ? ['<section class="footnotes" epub:type="footnotes">', ...notes, '</section>']
      : []),
    '</section>',
  ];
  return toXhtml(parts.join('\n'));
}

/** The book (or note) as an EPUB file's bytes. */
export function epub(request: ExportRequest): Uint8Array {
  const language = languageTag(request.language);
  const chapters = chaptersOf(request, false);
  const id = `urn:uuid:${uuidOf(request.key)}`;
  const title = escapeXml(request.title);
  const files = chapters.map((chapter, i) => ({
    path: `OEBPS/${chapterFile(i + 1)}`,
    data: page(language, chapter.headingText, chapterBody(chapter)),
  }));
  const titlePage = request.book
    ? [
        {
          path: 'OEBPS/title.xhtml',
          data: page(
            language,
            request.title,
            `<section epub:type="titlepage" class="title-page">\n<h1>${title}</h1>\n</section>`,
          ),
        },
      ]
    : [];
  const items = [
    ...(request.book
      ? ['<item id="title" href="title.xhtml" media-type="application/xhtml+xml"/>']
      : []),
    ...chapters.map(
      (_, i) =>
        `<item id="c${i + 1}" href="${chapterFile(i + 1)}" media-type="application/xhtml+xml"/>`,
    ),
  ];
  const spine = [
    ...(request.book ? ['<itemref idref="title"/>'] : []),
    ...chapters.map((_, i) => `<itemref idref="c${i + 1}"/>`),
  ];
  const opf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id" xml:lang="${language}">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
<dc:identifier id="book-id">${id}</dc:identifier>
<dc:title>${title}</dc:title>
<dc:language>${language}</dc:language>
<meta property="dcterms:modified">${utcSeconds(request.date)}</meta>
</metadata>
<manifest>
<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
<item id="style" href="style.css" media-type="text/css"/>
${items.join('\n')}
</manifest>
<spine toc="ncx">
${spine.join('\n')}
</spine>
</package>
`;
  const entries = chapters.map(
    (chapter, i) =>
      `<li><a href="${chapterFile(i + 1)}">${escapeXml(chapter.headingText)}</a></li>`,
  );
  const nav = page(
    language,
    'Contents',
    `<nav epub:type="toc" id="toc">\n<h1>Contents</h1>\n<ol>\n${entries.join('\n')}\n</ol>\n</nav>`,
  );
  const points = chapters.map(
    (chapter, i) =>
      `<navPoint id="np${i + 1}" playOrder="${i + 1}"><navLabel><text>${escapeXml(chapter.headingText)}</text></navLabel><content src="${chapterFile(i + 1)}"/></navPoint>`,
  );
  const ncx = `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1" xml:lang="${language}">
<head><meta name="dtb:uid" content="${id}"/></head>
<docTitle><text>${title}</text></docTitle>
<navMap>
${points.join('\n')}
</navMap>
</ncx>
`;
  return zipStore(
    [
      // First, and stored: how a reader knows it's an EPUB.
      { path: 'mimetype', data: 'application/epub+zip' },
      { path: 'META-INF/container.xml', data: CONTAINER },
      { path: 'OEBPS/content.opf', data: opf },
      { path: 'OEBPS/nav.xhtml', data: nav },
      { path: 'OEBPS/toc.ncx', data: ncx },
      { path: 'OEBPS/style.css', data: STYLE },
      ...titlePage,
      ...files,
    ],
    request.date,
  );
}
