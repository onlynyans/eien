// A long book's reading file with a bookmark in its last chapter, for the
// end-to-end tests that wait for the whole book to be counted (#40, Phase 4;
// #67): the count goes a chapter a task in the book's order, so that mark's
// row names its place (how far through the book) only once every chapter is.

import { epubKey } from '../../src/core/epub/epub';
import { openZip } from '../../src/core/epub/zip-read';

/** The vault's file for `book`'s reading state: a bookmark in its spine item `chapter` (its path in the zip). */
export function markedAtEnd(book: Uint8Array, chapter: string): Record<string, string> {
  const zip = openZip(book, () => {
    throw new Error('Only the directory is read.');
  });
  if (!('entries' in zip)) throw new Error('The book won’t open.');
  const bookmarks = [{ chapter, offset: 1000, words: 'Paragraph 7' }];
  return {
    [`.eien/reading/${epubKey(zip.entries)}.json`]: JSON.stringify({ version: 1, bookmarks }),
  };
}
