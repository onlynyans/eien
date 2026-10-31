// A book's bookmarks (#40, Phase 4b), in its reading state's file
// (./reading.ts): `"bookmarks": [{ "chapter", "offset", "words" }]`, each a
// page's first word (an offset in its chapter, ./place.ts) and the words it
// begins with, for the list. Changed in place in the file's own array, so a
// bookmark this Eien can't read, or a field it doesn't know, is kept as it
// is; a file a newer Eien wrote, or one that can't be read, is never written.

import { READING_VERSION, readingFile, writable } from './reading';

export interface Bookmark {
  /** The chapter's file in the zip. */
  readonly chapter: string;
  /** Where in it: its page's first word. */
  readonly offset: number;
  /** The words the page begins with, as the list shows them. */
  readonly words: string;
}

/** The most a book's list shows: a file with more is kept whole, only its first are read. */
export const MAX_BOOKMARKS = 1000;

/** The most of a page's first words a bookmark keeps. */
export const BOOKMARK_WORDS = 90;

/** A bookmark from the file, or null for an item this Eien can't read. */
function bookmarkOf(item: unknown): Bookmark | null {
  if (typeof item !== 'object' || item === null) return null;
  const { chapter, offset, words } = item as Record<string, unknown>;
  if (typeof chapter !== 'string' || chapter === '') return null;
  if (!Number.isSafeInteger(offset) || (offset as number) < 0) return null;
  return {
    chapter,
    offset: offset as number,
    words: typeof words === 'string' ? words.slice(0, BOOKMARK_WORDS * 2) : '',
  };
}

/** The bookmarks the file's text holds that this Eien can read, the first MAX_BOOKMARKS of them. */
export function bookmarksOf(text: string | null): Bookmark[] {
  const list = readingFile(text)?.bookmarks;
  if (!Array.isArray(list)) return [];
  const marks: Bookmark[] = [];
  for (const item of list) {
    const mark = bookmarkOf(item);
    if (mark) marks.push(mark);
    if (marks.length === MAX_BOOKMARKS) break;
  }
  return marks;
}

/** Whether two bookmarks are one: the same chapter and word. */
export const sameMark = (
  a: Pick<Bookmark, 'chapter' | 'offset'>,
  b: Pick<Bookmark, 'chapter' | 'offset'>,
) => a.chapter === b.chapter && a.offset === b.offset;

/**
 * The file's text with `add` added (unless it's there) and each of `remove`
 * taken off, every other item and field as it was; null when the file can't
 * be written (./reading.ts writable).
 */
export function withBookmarks(
  text: string | null,
  change: { readonly add?: Bookmark; readonly remove?: readonly Bookmark[] },
): string | null {
  const file = writable(text);
  if (!file) return null;
  const was: unknown[] = Array.isArray(file.bookmarks) ? file.bookmarks : [];
  const gone = (item: unknown) => {
    const mark = bookmarkOf(item);
    return mark !== null && (change.remove ?? []).some((other) => sameMark(mark, other));
  };
  const kept = was.filter((item) => !gone(item));
  const { add } = change;
  const there =
    add &&
    kept.some((item) => {
      const mark = bookmarkOf(item);
      return mark !== null && sameMark(mark, add);
    });
  const bookmarks = add && !there ? [...kept, { ...add }] : kept;
  const { version: _version, bookmarks: _bookmarks, ...rest } = file;
  return `${JSON.stringify({ version: READING_VERSION, ...rest, bookmarks }, null, 2)}\n`;
}

/**
 * The bookmarks on a page: in `chapter`, from its first word `from` up to
 * (not at) `to`; a page of no words (a picture's) holds the place it stands at.
 */
export const bookmarksOn = (
  marks: readonly Bookmark[],
  chapter: string,
  from: number,
  to: number,
): Bookmark[] => {
  const end = Math.max(to, from + 1);
  return marks.filter(
    (mark) => mark.chapter === chapter && mark.offset >= from && mark.offset < end,
  );
};

/**
 * The bookmarks in the book's order, by their chapters' places in `spine`
 * (its files' paths) and then their words; one whose chapter isn't in it is
 * left out (kept in the file, never shown).
 */
export function inBookOrder(marks: readonly Bookmark[], spine: readonly string[]): Bookmark[] {
  const at = new Map(spine.map((path, i) => [path, i]));
  return marks
    .filter((mark) => at.has(mark.chapter))
    .sort(
      (a, b) =>
        (at.get(a.chapter) as number) - (at.get(b.chapter) as number) || a.offset - b.offset,
    );
}

/** A page's first words as a bookmark keeps them: whole words, its space run together, an ellipsis where it goes on. */
export function firstWords(text: string, max = BOOKMARK_WORDS): string {
  const words = text.replace(/\s+/gu, ' ').trim();
  if (words.length <= max) return words;
  const cut = words.slice(0, max + 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > 0 ? cut.slice(0, space) : words.slice(0, max)).trimEnd()}…`;
}
