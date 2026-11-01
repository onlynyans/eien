// What the fixture books (#40) are made of, by hand: an EPUB's pages, its
// package and nav, and the zip round them (./epub-zip.ts), the mimetype first.
// Shared by the plain variants (./epub-fixtures.ts) and the hostile ones
// (./epub-hostile.ts).

import { type HandEntry, handZip } from './epub-zip';

export const TITLE = 'Pride and Prejudice';

export const escaped = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const MIMETYPE: HandEntry = { name: 'mimetype', data: 'application/epub+zip' };
export const container = (opf: string): HandEntry => ({
  name: 'META-INF/container.xml',
  data: `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
<rootfiles><rootfile full-path="${opf}" media-type="application/oebps-package+xml"/></rootfiles>
</container>`,
});

export const page = (title: string, body: string) => `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><title>${escaped(title)}</title><link rel="stylesheet" href="../styles/book.css"/></head>
<body>
${body}
</body>
</html>`;

export const paragraphs = (paras: readonly string[]) =>
  paras.map((para) => `<p>${escaped(para)}</p>`).join('\n');

export interface Item {
  readonly id: string;
  readonly href: string;
  readonly type: string;
  readonly properties?: string;
}

/** An OPF of `version` holding `items`, its spine `spine` (ids), its NCX named by `toc`. */
export const opf = (
  version: '2.0' | '3.0',
  items: readonly Item[],
  spine: readonly string[],
  toc?: string,
) =>
  `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="${version}" unique-identifier="id">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
<dc:identifier id="id">urn:eien:fixture:${version}</dc:identifier>
<dc:title>${TITLE}</dc:title>
<dc:creator>Jane Austen</dc:creator>
<dc:language>en</dc:language>
</metadata>
<manifest>
${items
  .map(
    (item) =>
      `<item id="${item.id}" href="${item.href}" media-type="${item.type}"${item.properties ? ` properties="${item.properties}"` : ''}/>`,
  )
  .join('\n')}
</manifest>
<spine${toc ? ` toc="${toc}"` : ''}>
${spine.map((id) => `<itemref idref="${id}"/>`).join('\n')}
</spine>
</package>`;

export const XHTML = 'application/xhtml+xml';
/** EPUB 3's nav: the contents, and the printed pages when given. */
export const nav = (rows: readonly [string, string][], pages: readonly [string, string][] = []) =>
  page(
    'Contents',
    `<nav epub:type="toc"><h1>Contents</h1><ol>
${rows.map(([title, href]) => `<li><a href="${href}">${escaped(title)}</a></li>`).join('\n')}
</ol></nav>${
      pages.length > 0
        ? `\n<nav epub:type="page-list" hidden=""><ol>
${pages.map(([label, href]) => `<li><a href="${href}">${label}</a></li>`).join('\n')}
</ol></nav>`
        : ''
    }`,
  );

/** An EPUB made by hand: the mimetype first, stored; the rest deflated unless said. */
export const handEpub = (opfPath: string, entries: readonly HandEntry[]) =>
  handZip([
    MIMETYPE,
    container(opfPath),
    ...entries.map((entry) => ({ method: 8 as const, ...entry })),
  ]);

/** A small EPUB 3 round one chapter page `body`, with `more` entries beside it. */
export const oneChapter = (body: string, more: readonly HandEntry[] = []) =>
  handEpub('content.opf', [
    {
      name: 'content.opf',
      data: opf(
        '3.0',
        [
          { id: 'nav', href: 'nav.xhtml', type: XHTML, properties: 'nav' },
          { id: 'c1', href: 'chapter.xhtml', type: XHTML },
        ],
        ['c1'],
      ),
    },
    { name: 'nav.xhtml', data: nav([['Chapter I', 'chapter.xhtml']]) },
    { name: 'chapter.xhtml', data: page('Chapter I', body) },
    ...more,
  ]);
