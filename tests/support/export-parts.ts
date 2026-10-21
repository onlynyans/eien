// The parts of an export, for tests: an EPUB's or a Word file's XML read
// back from its zip, and the words a page of it shows.

import { readZip } from './read-zip';

/** Every XML part of a zip (by its name's end), as text. */
export function xmlParts(zip: Uint8Array): Map<string, string> {
  const read = readZip(zip);
  return new Map(
    read.names
      .filter((name) => /\.(?:xml|xhtml|opf|ncx|rels)$/u.test(name))
      .map((name) => [name, read.text(name)]),
  );
}

/** What a reader shows of XML or HTML: its text, tags out, references read, spaces as one. */
export function shownText(markup: string): string {
  return markup
    .replace(/<(?:w:tab|w:br|br)\b[^>]*>|<\/(?:w:p|p|li|td|th|h[1-6]|div|aside|title|text)>/gu, ' ')
    .replace(/<[^>]*>/gu, '')
    .replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/giu, (_, ref: string) => {
      if (ref.startsWith('#x') || ref.startsWith('#X'))
        return String.fromCodePoint(Number.parseInt(ref.slice(2), 16));
      if (ref.startsWith('#')) return String.fromCodePoint(Number(ref.slice(1)));
      return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[ref.toLowerCase()] ?? '';
    })
    .replace(/\s+/gu, ' ')
    .trim();
}
