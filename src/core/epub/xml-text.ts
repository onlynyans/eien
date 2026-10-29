// A book's XML file (its package, contents or a chapter) as text for
// core/html's parser (#40): UTF-8, as EPUB 3 asks; UTF-16 where a byte-order
// mark says so, as EPUB 2 allows; Windows-1252 where an old book's
// declaration names it or Latin-1 (as browsers read both); and its CDATA
// sections as plain, escaped text, which the parser (made for pasted HTML)
// would otherwise drop.

import { escapeHtml } from '../html';
import { fromLatin1, fromUtf8 } from './utf8';

/** Labels a browser reads as Windows-1252 (WHATWG's Encoding: latin1, ascii and the rest). */
const LATIN =
  /^<\?xml[^>]*\bencoding\s*=\s*["'](?:iso-8859-1|latin-?1|windows-1252|cp1252|us-ascii|ascii)["']/iu;

/** What Windows-1252 has at 0x80 to 0x9F, where Latin-1 has controls: quotes, dashes, the euro. */
const CP1252 = '€\u0081‚ƒ„…†‡ˆ‰Š‹Œ\u008dŽ\u008f\u0090‘’“”•–—˜™š›œ\u009džŸ';

const CDATA = /<!\[CDATA\[([\s\S]*?)(?:\]\]>|$)/gu;

/** `bytes` as UTF-16, little-endian or big, from after its byte-order mark. */
function fromUtf16(bytes: Uint8Array, little: boolean): string {
  const units: number[] = [];
  const parts: string[] = [];
  for (let at = 2; at + 1 < bytes.length; at += 2) {
    const [low, high] = little ? [bytes[at], bytes[at + 1]] : [bytes[at + 1], bytes[at]];
    units.push(((high as number) << 8) | (low as number));
    if (units.length === 8192) parts.push(String.fromCharCode(...units.splice(0)));
  }
  parts.push(String.fromCharCode(...units));
  return parts.join('').toWellFormed();
}

/** The text `bytes` hold, ready for parseHtml. */
export function xmlText(bytes: Uint8Array): string {
  let text: string;
  if (bytes[0] === 0xff && bytes[1] === 0xfe) text = fromUtf16(bytes, true);
  else if (bytes[0] === 0xfe && bytes[1] === 0xff) text = fromUtf16(bytes, false);
  else if (LATIN.test(fromLatin1(bytes.subarray(0, 200)))) {
    text = fromLatin1(bytes).replace(
      /[\u0080-\u009f]/gu,
      (char) => CP1252[char.charCodeAt(0) - 0x80] as string,
    );
  } else text = fromUtf8(bytes);
  return text.replace(CDATA, (_whole, inner: string) => escapeHtml(inner));
}
