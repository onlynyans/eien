// What XML asks of text, for EPUB's XHTML and Word's parts: only the
// characters XML 1.0 allows, and only its five named references. A reader
// that meets anything else refuses the whole file.

import { NAMED_ENTITIES } from '../ao3';

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
 * "&nbsp;", "&eacute;", "&#8212;"…) as the characters they are, but XML's
 * five; a number past Unicode as U+FFFD, as a browser shows it; anything
 * else the parser took for a reference ("R&D;", "&Q_A;") as its words; what
 * XML can't hold, gone.
 */
export function toXhtml(html: string): string {
  return xmlChars(html)
    .replace(OBSOLETE, '')
    .replace(
      /&(?:#[xX]([0-9a-fA-F]+)|#([0-9]+)|([A-Za-z][A-Za-z0-9]*));|&/gu,
      (whole, hex?: string, decimal?: string, name?: string) => {
        if (hex !== undefined || decimal !== undefined) {
          const code = hex !== undefined ? Number.parseInt(hex, 16) : Number(decimal);
          const real = code > 0 && code <= 0x10ffff && (code < 0xd800 || code > 0xdfff);
          const char = real ? String.fromCodePoint(code) : '\ufffd';
          return XML_NAMED[char] ?? xmlChars(char);
        }
        const char = name === undefined ? undefined : NAMED_ENTITIES.get(name);
        if (char !== undefined) return XML_NAMED[char] ?? char;
        return `&amp;${whole.slice(1)}`; // names nothing: its words
      },
    );
}
