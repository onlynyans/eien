// What an export is made from (spec §8): a book's chapters in its order, or
// one note; the vault's quotes; and what the system says of the writer's
// language and paper.

import type { QuoteStyle } from '../typography';
import { type Chapter, chapterOf, type ExportImage, type ExportNote } from './chapter';

/** Each export's name in a menu (spec §8): the menu bar's, and a note's or a book's own. */
export const EXPORT_LABELS = {
  html: 'AO3 HTML…',
  epub: 'EPUB…',
  docx: 'Word (.docx)…',
  pdf: 'PDF…',
} as const;

/** The paper Word and the PDF are set on. */
export type PageSize = 'a4' | 'letter';

export interface ExportRequest {
  /** The book's title (its folder's name), or the note's. */
  readonly title: string;
  /** The notes in order: a book's chapters, or the one note. */
  readonly notes: readonly ExportNote[];
  /** A book has a title page before its chapters; a note doesn't. */
  readonly book: boolean;
  readonly quotes: QuoteStyle;
  /** The system's language, a BCP 47 tag ("en-GB"); see languageTag. */
  readonly language: string;
  /** What makes it this book or note, so its EPUB's identifier is the same each time. */
  readonly key: string;
  /** When it's made. */
  readonly date: Date;
}

/** `tag` when it reads as a language tag ("en", "pt-BR", "zh-Hant-TW"), else English. */
export const languageTag = (tag: string): string =>
  /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{1,8})*$/u.test(tag) ? tag : 'en';

/** Where letter paper is the custom (Unicode CLDR's list); A4 everywhere else. */
const LETTER = new Set('US CA MX PH CL CO CR GT NI PA PE PR SV VE BZ'.split(' '));

/** The paper for the region a language tag names ("en-US" → letter); A4 with none. */
export function pageSizeOf(language: string): PageSize {
  const region = languageTag(language)
    .split('-')
    .slice(1)
    .find((part) => /^[A-Za-z]{2}$/u.test(part));
  return region && LETTER.has(region.toUpperCase()) ? 'letter' : 'a4';
}

/**
 * A UUID made from `key` (four FNV-1a hashes, version and variant set), so
 * a book exported again has the identifier it had: a reader keeps it as one
 * book. Not secret, and not meant to be.
 */
export function uuidOf(key: string): string {
  let hex = '';
  for (const seed of [0x811c_9dc5, 0x050c_5d1f, 0x2b5c_93e3, 0x6d2b_79f5]) {
    let hash = seed;
    for (let i = 0; i < key.length; i++) {
      hash ^= key.charCodeAt(i);
      hash = Math.imul(hash, 0x0100_0193);
    }
    hex += (hash >>> 0).toString(16).padStart(8, '0');
  }
  const variant = ((Number.parseInt(hex[16] as string, 16) & 3) | 8).toString(16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

/** Where a book's writer puts an image, for each format to give its own address: "eien-image:<n>". */
export const IMAGE_SRC = /^eien-image:(\d+)$/u;

/**
 * The request's chapters, and the images they show, each once, numbered
 * from 0 in the order the notes hold them; an image in the chapters is
 * `<img src="eien-image:<n>">`. Footnote ids begin `c<n>-` when `prefixed`
 * (one page for every chapter).
 */
export function chaptersOf(
  request: ExportRequest,
  prefixed: boolean,
): { chapters: Chapter[]; images: ExportImage[] } {
  const images: ExportImage[] = [];
  const numbers = new Map<string, number>();
  const chapters = request.notes.map((note, i) =>
    chapterOf(note, request.quotes, prefixed ? `c${i + 1}-` : '', (address) => {
      const image = note.images?.get(address);
      if (!image) return null;
      let n = numbers.get(image.key);
      if (n === undefined) {
        n = images.push(image) - 1;
        numbers.set(image.key, n);
      }
      return `eien-image:${n}`;
    }),
  );
  return { chapters, images };
}

/** "2026-10-20T16:40:02Z": the time to the second, in UTC. */
export const utcSeconds = (date: Date): string =>
  (Number.isNaN(date.getTime()) ? new Date(0) : date).toISOString().replace(/\.\d{3}Z$/u, 'Z');
