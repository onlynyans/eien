// The end-to-end budgets' seeded reading file (support/marked-book.ts) names
// the book the app opens and a chapter in its spine, so its mark's row is
// what they wait on, never a file the window passes by.

import { inflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { isRefusal, openEpub } from '../src/core/epub';
import { longBook } from './support/long-book';
import { markedAtEnd } from './support/marked-book';

describe('a long book’s seeded reading file', () => {
  it('is the book’s own, its mark in its last chapter', async () => {
    const book = longBook({ chapters: 3, paragraphs: 5, large: 10 });
    const epub = await openEpub(book, async function* (raw) {
      yield new Uint8Array(inflateRawSync(raw));
    });
    if (isRefusal(epub)) throw new Error(epub.refused);
    const [[path, text]] = Object.entries(markedAtEnd(book, 'c3.xhtml')) as [[string, string]];
    expect(path).toBe(`.eien/reading/${epub.key}.json`);
    expect(epub.spine.at(-1)?.path).toBe('c3.xhtml');
    expect(JSON.parse(text).bookmarks[0].chapter).toBe('c3.xhtml');
  });
});
