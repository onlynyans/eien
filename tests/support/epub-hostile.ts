// The hostile fixture books (#40): each must be refused, or drawn with nothing
// that runs or reaches outside the book.

import type { EpubSources } from './epub-fixtures';
import { escaped, oneChapter, paragraphs } from './epub-parts';
import { zerosDeflate } from './epub-zip';

/** Links that would leave the book or run, ids that would name the window's, a note that runs. */
function hostileLinks(sources: EpubSources): Uint8Array {
  const [one = []] = sources.chapters;
  const hrefs = [
    'javascript:window.eienRan = true',
    'https://example.com/',
    '//example.com/',
    'data:text/html,<script>window.eienRan=true</script>',
    '../../../etc/passwd',
    'content.opf',
    'chapter.xhtml#%',
    'file:///etc/passwd',
  ];
  return oneChapter(
    `<h1 id="settings">Chapter I.</h1>
<p id="__proto__">${escaped(one[0] ?? '')}<a epub:type="noteref" href="#nowhere">1</a> <a epub:type="noteref" href="#n-bad">2</a></p>
<p>${hrefs.map((href, n) => `<a href="${escaped(href)}">way ${n}</a>`).join(' ')}</p>
<p id="${'x'.repeat(300)}"><a name="body" href="#settings">Back to the top.</a></p>
<aside epub:type="footnote" id="n-bad"><p onclick="window.eienRan = true">A note <script>window.eienRan = true</script>that runs nothing.</p></aside>`,
  );
}

/** The hostile books: each must be refused, or drawn with nothing that runs or reaches out. */
export function hostileEpubs(sources: EpubSources): Record<string, Uint8Array> {
  const [one = []] = sources.chapters;
  const words = paragraphs(one.slice(0, 2));
  // Two MiB of zeros in 13 KiB: far past the ratio a book's text could reach.
  const zeros = 1 + 258 * 8128;
  return {
    'links-hostile.epub': hostileLinks(sources),
    'bomb.epub': oneChapter(words, [
      { name: 'filler.xhtml', data: new Uint8Array(zeros), method: 8, packed: zerosDeflate(zeros) },
    ]),
    'lying.epub': oneChapter(words, [
      // Declares 1 KiB; inflates to 64 KiB.
      {
        name: 'filler.xhtml',
        data: new Uint8Array(1 + 258 * 254),
        method: 8,
        packed: zerosDeflate(1 + 258 * 254),
        declared: 1024,
      },
    ]),
    'escape.epub': oneChapter(words, [{ name: '../../outside.txt', data: 'Out of the zip.' }]),
    'drm.epub': oneChapter(words, [
      {
        name: 'META-INF/encryption.xml',
        data: `<?xml version="1.0"?><encryption xmlns="urn:oasis:names:tc:opendocument:xmlns:container" xmlns:enc="http://www.w3.org/2001/04/xmlenc#"><enc:EncryptedData><enc:EncryptionMethod Algorithm="http://www.w3.org/2001/04/xmlenc#aes128-cbc"/><enc:CipherData><enc:CipherReference URI="chapter.xhtml"/></enc:CipherData></enc:EncryptedData></encryption>`,
      },
    ]),
    'script.epub': oneChapter(
      `<script>window.eienRan = true;</script>
<h1 onclick="window.eienRan = true">Chapter I.</h1>
<p onmouseover="window.eienRan = true" style="color: red">${escaped(one[0] ?? '')}</p>
<p><a href="javascript:window.eienRan = true">A link that runs</a> and <a href="https://example.com/">one to the web</a>.</p>
<p><img src="https://example.com/beacon.png" alt="A remote picture" onerror="window.eienRan = true"/></p>
<iframe src="https://example.com/"></iframe>
<object data="chapter.xhtml"></object>
<form action="https://example.com/"><input name="q"/><button>Send</button></form>
<style>p { display: none; }</style>
<svg><script>window.eienRan = true;</script></svg>
<p>${escaped(one[1] ?? '')}</p>`,
    ),
  };
}
