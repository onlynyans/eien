// The page a PDF is printed from (spec §8): one HTML page holding the
// title (a book's) and every chapter, each from a new page, its footnotes
// at its end, its images in it as data. The system's serif sets it;
// Chromium prints it. It runs no script and loads nothing: its policy
// allows only its own styles and images held as data.

import { escapeHtml } from '../ao3';
import { chaptersOf, type ExportRequest, languageTag } from './book';
import { dataAddress } from './images';
import { xmlChars } from './xml';

const STYLE = `
html { font-family: Georgia, "Times New Roman", "Liberation Serif", "DejaVu Serif", serif; font-size: 11.5pt; line-height: 1.45; }
body { margin: 0; hyphens: auto; }
h1 { font-size: 1.6em; font-weight: normal; text-align: center; margin: 4em 0 2em; break-after: avoid; }
h2, h3, h4, h5, h6 { font-size: 1.1em; margin: 1.4em 0 0.4em; break-after: avoid; }
p { margin: 0; text-indent: 1.5em; orphans: 2; widows: 2; }
h1 + p, h2 + p, h3 + p, h4 + p, h5 + p, h6 + p, .scene-break + p, blockquote p, li p, .footnotes p { text-indent: 0; }
.scene-break { margin: 1em 0; text-align: center; text-indent: 0; }
blockquote { margin: 0.8em 2em; }
img { max-width: 100%; max-height: 90vh; height: auto; }
pre { white-space: pre-wrap; font-size: 0.85em; }
mark { background: #fff1a8; color: inherit; }
table { border-collapse: collapse; margin: 0.8em 0; }
td, th { border: 0.5pt solid #777; padding: 0.15em 0.4em; }
a { color: inherit; }
.chapter { break-before: page; }
.title-page { break-after: page; padding-top: 30vh; text-align: center; }
.title-page h1 { font-size: 2.2em; margin: 0; }
.footnotes { margin-top: 1.5em; padding-top: 0.5em; border-top: 0.5pt solid #777; font-size: 0.85em; }
.footnotes .note { margin-bottom: 0.4em; }
`;

/** The book (or note) as the HTML page the PDF is printed from. */
export function printHtml(request: ExportRequest): string {
  const { chapters: written, images } = chaptersOf(request, true);
  const chapters = written.map((chapter, i) => {
    const ids = `c${i + 1}-`;
    const notes = chapter.notes.map(({ blocks, referred }, j) => {
      const n = j + 1;
      const back = referred ? `<a href="#${ids}fnref${n}">${n}.</a> ` : `${n}. `;
      const [first = '', ...rest] = blocks;
      const opened = first.startsWith('<p>')
        ? `<p>${back}${first.slice(3)}`
        : `<p>${back}</p>${first}`;
      return `<div class="note" id="${ids}fn${n}">\n${[opened, ...rest].join('\n')}\n</div>`;
    });
    return [
      `<section class="chapter">`,
      `<h1>${chapter.heading}</h1>`,
      ...chapter.blocks,
      ...(notes.length ? ['<div class="footnotes">', ...notes, '</div>'] : []),
      '</section>',
    ].join('\n');
  });
  const title = escapeHtml(xmlChars(request.title));
  const titlePage = request.book ? [`<section class="title-page"><h1>${title}</h1></section>`] : [];
  const language = escapeHtml(languageTag(request.language));
  return `<!DOCTYPE html>
<html lang="${language}">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:">
<title>${title}</title>
<style>${STYLE}</style>
</head>
<body>
${xmlChars([...titlePage, ...chapters].join('\n')).replace(
  /<img src="eien-image:(\d+)"/gu,
  (whole, n: string) => {
    const image = images[Number(n)];
    return image ? `<img src="${dataAddress(image.info.kind, image.bytes)}"` : whole;
  },
)}
</body>
</html>
`;
}
