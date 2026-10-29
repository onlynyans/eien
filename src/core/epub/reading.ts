// What Eien keeps of your reading of a book (#40), in the vault, so it
// syncs: `.eien/reading/<key>.json`, the key from what the book holds
// (./epub.ts epubKey), so a book renamed or moved keeps it. The chapter
// you were in, and your place in it (Phase 2: an offset in its words,
// ./place.ts); bookmarks and highlights join it later (Phases 4, 5). Every
// field this Eien doesn't know is kept as it was, so an older Eien never
// drops a newer one's.

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

interface ReadingFile {
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
function fileOf(text: string | null): ReadingFile | null {
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
  const file = fileOf(text);
  const chapter = typeof file?.chapter === 'string' && file.chapter !== '' ? file.chapter : null;
  return { chapter, offset: chapter === null ? 0 : offsetIn(file?.place, chapter) };
}

/** The newest version of the file this Eien writes. */
const VERSION = 1;

/**
 * The file's text with `reading` in it, every other field as it was; a file
 * that can't be read, begun again. Null for a file a newer Eien wrote (spec
 * §2, Formats): it's read for what it can, and never written over.
 */
export function withReading(text: string | null, reading: Reading): string | null {
  const file = fileOf(text) ?? {};
  if (typeof file.version === 'number' && file.version > VERSION) return null;
  const { version: _version, chapter: _chapter, place: _place, ...rest } = file;
  const { chapter, offset } = reading;
  const place = chapter === null ? {} : { place: { chapter, offset: Math.max(0, offset) } };
  return `${JSON.stringify({ version: VERSION, ...rest, chapter, ...place }, null, 2)}\n`;
}
