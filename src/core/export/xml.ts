// What XML asks of text, for EPUB's XHTML and Word's parts: only the
// characters XML 1.0 allows, and only its five named references. A reader
// that meets anything else refuses the whole file.

import { decodeEntities } from '../ao3';

/** Characters XML 1.0 can't hold, even as references: controls (but tab and line ends), lone surrogates, U+FFFE, U+FFFF. */
// biome-ignore lint/suspicious/noControlCharactersInRegex: the control characters are what's removed
const NOT_XML = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]|\p{Cs}/gu;

/** `text` without the characters XML can't hold. */
export const xmlChars = (text: string): string => text.replace(NOT_XML, '');

/** `text` as XML's character data or an attribute's value. */
export const escapeXml = (text: string): string =>
  xmlChars(text)
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;');

const XML_NAMED: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
};

/** Tags HTML has dropped, which an EPUB may not hold: their words stay. */
const OBSOLETE = /<\/?big>/gu;

/**
 * The HTML core/ao3 writes, as XHTML: its references (the note's own
 * "&nbsp;", "&mdash;"…) as the characters they are, but XML's five; one
 * that names nothing as its words; what XML can't hold, gone.
 */
export function toXhtml(html: string): string {
  return xmlChars(html)
    .replace(OBSOLETE, '')
    .replace(/&(#x[0-9a-f]{1,6}|#\d{1,7}|[a-z][a-z0-9]{1,31});/giu, (whole) => {
      const char = decodeEntities(whole);
      if (char === whole) return `&amp;${whole.slice(1)}`; // names nothing: its words
      return XML_NAMED[char] ?? xmlChars(char);
    });
}
