// A book's bookmarks (#40, Phase 4b), in its reading state's file
// (./reading.ts): `"bookmarks": [{ "chapter", "offset", "words" }]`, each a
// page's first word (an offset in its chapter, ./place.ts) and the words it
// begins with, for the list; kept as every list in the file is
// (./reading-list.ts).

import { sightEnd } from './place';
import { type ListChange, type ListKind, listIn, withList } from './reading-list';

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

/** Whether two bookmarks are one: the same chapter and word. */
export const sameMark = (
  a: Pick<Bookmark, 'chapter' | 'offset'>,
  b: Pick<Bookmark, 'chapter' | 'offset'>,
) => a.chapter === b.chapter && a.offset === b.offset;

/** How the file keeps bookmarks: the list's field, an item read, two told apart. */
const BOOKMARKS: ListKind<Bookmark> = {
  field: 'bookmarks',
  read: bookmarkOf,
  same: sameMark,
};

/** The bookmarks the file's text holds that this Eien can read, the first MAX_BOOKMARKS of them. */
export const bookmarksOf = (text: string | null): Bookmark[] =>
  listIn(text, BOOKMARKS, MAX_BOOKMARKS);

/**
 * The file's text with `add` added (unless it's there) and each of `remove`
 * taken off, every other item and field as it was; null when the file can't
 * be written (./reading.ts writable).
 */
export const withBookmarks = (text: string | null, change: ListChange<Bookmark>): string | null =>
  withList(text, BOOKMARKS, change);

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
  const end = sightEnd(from, to);
  return marks.filter(
    (mark) => mark.chapter === chapter && mark.offset >= from && mark.offset < end,
  );
};

/** A page's first words as a bookmark keeps them: whole words, its space run together, an ellipsis where it goes on. */
export function firstWords(text: string, max = BOOKMARK_WORDS): string {
  const words = text.replace(/\s+/gu, ' ').trim();
  if (words.length <= max) return words;
  const cut = words.slice(0, max + 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > 0 ? cut.slice(0, space) : words.slice(0, max)).trimEnd()}…`;
}
