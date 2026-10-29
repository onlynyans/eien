// What Eien keeps of your reading of a book (#40), in the vault, so it
// syncs: `.eien/reading/<key>.json`, the key from what the book holds
// (./epub.ts epubKey), so a book renamed or moved keeps it. Now the chapter
// you were in; your place in it, bookmarks and highlights join it later
// (Phases 2, 4, 5). Every field this Eien doesn't know is kept as it was,
// so an older Eien never drops a newer one's.

import { withoutBom } from '../text';

export const READING_FOLDER = '.eien/reading';

/** The reading state's file for the book `key` names. */
export const readingPath = (key: string): string => `${READING_FOLDER}/${key}.json`;

export interface Reading {
  /** The chapter last open: its file's path in the zip. */
  readonly chapter: string | null;
}

interface ReadingFile {
  version?: unknown;
  chapter?: unknown;
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

/** What the file's text says; nothing kept for no file, or one that can't be read. */
export function parseReading(text: string | null): Reading {
  const chapter = fileOf(text)?.chapter;
  return { chapter: typeof chapter === 'string' && chapter !== '' ? chapter : null };
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
  const { version: _version, chapter: _chapter, ...rest } = file;
  return `${JSON.stringify({ version: VERSION, ...rest, chapter: reading.chapter }, null, 2)}\n`;
}
