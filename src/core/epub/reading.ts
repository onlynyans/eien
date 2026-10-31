// What Eien keeps of your reading of a book (#40), in the vault, so it
// syncs: `.eien/reading/<key>.json`, the key from what the book holds
// (./epub.ts epubKey), so a book renamed or moved keeps it. The chapter
// you were in, and your place in it (Phase 2: an offset in its words,
// ./place.ts); its bookmarks (Phase 4b, ./bookmarks.ts), and highlights
// later (Phase 5). Every field this Eien doesn't know is kept as it was, so
// an older Eien never drops a newer one's; and a file this Eien can't read
// (one a sync broke, say) is never written over, so nothing in it is lost.

import { withoutBom } from '../text';

export const READING_FOLDER = '.eien/reading';

/** The reading state's file for the book `key` names. */
export const readingPath = (key: string): string => `${READING_FOLDER}/${key}.json`;

export interface Reading {
  /** The chapter last open: its file's path in the zip. */
  readonly chapter: string | null;
  /** Where in it: an offset in its words (./place.ts), 0 for its top. */
  readonly offset: number;
}

export interface ReadingFile {
  version?: unknown;
  chapter?: unknown;
  /**
   * The place in a chapter, with the chapter it's in: an Eien from before
   * places (Phase 1) writes `chapter` alone and keeps this as it was, so an
   * offset counts only beside the chapter it names.
   */
  place?: unknown;
  [other: string]: unknown;
}

/** The file's fields, or null for no file, or one that isn't a JSON object. */
export function readingFile(text: string | null): ReadingFile | null {
  if (!text) return null;
  try {
    const data: unknown = JSON.parse(withoutBom(text));
    return typeof data === 'object' && data !== null && !Array.isArray(data)
      ? (data as ReadingFile)
      : null;
  } catch {
    return null;
  }
}

/** The offset `place` gives in `chapter`, or 0 when it's another chapter's or not an offset. */
function offsetIn(place: unknown, chapter: string): number {
  if (typeof place !== 'object' || place === null) return 0;
  const { chapter: at, offset } = place as { chapter?: unknown; offset?: unknown };
  return at === chapter && Number.isSafeInteger(offset) && (offset as number) > 0
    ? (offset as number)
    : 0;
}

/** What the file's text says; nothing kept for no file, or one that can't be read. */
export function parseReading(text: string | null): Reading {
  const file = readingFile(text);
  const chapter = typeof file?.chapter === 'string' && file.chapter !== '' ? file.chapter : null;
  return { chapter, offset: chapter === null ? 0 : offsetIn(file?.place, chapter) };
}

/** The newest version of the file this Eien writes. */
export const READING_VERSION = 1;

/** How the file stands: none yet, one this Eien keeps, a newer Eien's, or one it can't read. */
export type ReadingKept = 'none' | 'kept' | 'newer' | 'unreadable';

export function readingKept(text: string | null): ReadingKept {
  if (!text) return 'none';
  const file = readingFile(text);
  if (!file) return 'unreadable';
  return typeof file.version === 'number' && file.version > READING_VERSION ? 'newer' : 'kept';
}

/**
 * The file's fields to write again, or null for one that mustn't be: a newer
 * Eien's (spec §2, Formats), read for what it can, or one this Eien can't
 * read, left as it is until it's fixed or deleted. No file begins empty.
 */
export function writable(text: string | null): ReadingFile | null {
  const kept = readingKept(text);
  if (kept === 'newer' || kept === 'unreadable') return null;
  return readingFile(text) ?? {};
}

/** The file's text with `reading` in it, every other field as it was and where it was; null where it mustn't be written. */
export function withReading(text: string | null, reading: Reading): string | null {
  const file = writable(text);
  if (!file) return null;
  const { chapter, offset } = reading;
  // The file spread first, so each field keeps its place (./reading-list.ts does the same).
  const next: ReadingFile = { version: READING_VERSION, ...file, chapter };
  next.version = READING_VERSION;
  if (chapter === null) delete next.place;
  else next.place = { chapter, offset: Math.max(0, offset) };
  return `${JSON.stringify(next, null, 2)}\n`;
}
