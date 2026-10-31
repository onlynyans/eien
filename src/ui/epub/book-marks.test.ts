// `]` and `[` on a book's page (#40, Phase 5b), over a real page and a vault
// in memory: every mark, bookmarks and highlights, walked in the book's
// order across its chapters, round the book past either end, each said in
// the colophon; and none kept said so.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { fixtureEpubs, SAMPLE_SOURCES } from '../../../tests/support/epub-fixtures';
import { readingPath } from '../../core/epub';
import { NO_MARKS } from '../list/contents-list';
import type { EpubSide } from './epub-side-types';
import { laidOut } from './test-lines';
import { sideWith } from './test-side';

const EPUBS = fixtureEpubs(SAMPLE_SOURCES);
const chapter = (n: number) => `OEBPS/chapter-${n}.xhtml`;

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

/** A book open at its first chapter's top, its reading file holding `marks` first. */
async function opened(marks: object) {
  const peek = sideWith({ 'a.epub': EPUBS['plain.epub'] as Uint8Array });
  await peek.side.open('a.epub');
  const key = peek.side.epub?.key ?? '';
  peek.side.dispose();
  const at = sideWith({ 'a.epub': EPUBS['plain.epub'] as Uint8Array });
  laidOut(at.side.page);
  await at.disk.write(readingPath(key), JSON.stringify({ version: 1, ...marks }), null);
  await at.side.open('a.epub');
  return at;
}

const press = (side: EpubSide, key: string) =>
  side.page.key(new KeyboardEvent('keydown', { key, cancelable: true }));
const said = (side: EpubSide) => side.page.foot.said.textContent;
/** Where the page is: the chapter drawn, by its file. */
const where = (side: EpubSide) => side.epub?.spine[side.spine]?.path;

describe('] and [ walking a book’s marks', () => {
  const MARKS = {
    bookmarks: [{ chapter: chapter(3), offset: 0, words: 'third' }],
    highlights: [{ chapter: chapter(2), from: 10, to: 20, words: 'second' }],
  };

  it('go to the next mark past the words in sight and the one before, each kind said', async () => {
    const { side } = await opened(MARKS);
    expect(where(side)).toBe(chapter(1));
    press(side, ']');
    await vi.waitFor(() => expect(where(side)).toBe(chapter(2)));
    expect(said(side)).toBe('Highlight, 1 of 2 marks.');
    press(side, ']');
    await vi.waitFor(() => expect(where(side)).toBe(chapter(3)));
    expect(said(side)).toBe('Bookmark, 2 of 2 marks.');
    press(side, '[');
    await vi.waitFor(() => expect(where(side)).toBe(chapter(2)));
  });

  it('go round the book past its end, and say so', async () => {
    const { side } = await opened(MARKS);
    press(side, '[');
    await vi.waitFor(() => expect(where(side)).toBe(chapter(3)));
    expect(said(side)).toBe('Round to the last: Bookmark, 2 of 2 marks.');
    press(side, ']');
    await vi.waitFor(() => expect(where(side)).toBe(chapter(2)));
    expect(said(side)).toBe('Round to the first: Highlight, 1 of 2 marks.');
  });

  it('say there are none to walk in a book with none kept', async () => {
    const { side } = await opened({});
    press(side, ']');
    expect(said(side)).toBe(NO_MARKS);
    expect(where(side)).toBe(chapter(1));
  });

  it('pass over a mark in a chapter the book no longer has', async () => {
    const { side } = await opened({
      highlights: [
        { chapter: 'OEBPS/gone.xhtml', from: 0, to: 5, words: '' },
        { chapter: chapter(2), from: 0, to: 5, words: '' },
      ],
    });
    press(side, ']');
    await vi.waitFor(() => expect(where(side)).toBe(chapter(2)));
    expect(said(side)).toBe('Highlight, 1 of 1 mark.');
  });
});

// QA (#40, Phase 5b): a walk within the chapter drawn, its words in sight
// measured again as each mark is shown; and both kinds at one word.
describe('] and [ within one chapter, as QA tried them', () => {
  it('step from mark to mark in the chapter drawn, never back to the one just shown', async () => {
    const { side } = await opened({
      bookmarks: [{ chapter: chapter(1), offset: 400, words: '' }],
      highlights: [{ chapter: chapter(1), from: 200, to: 220, words: '' }],
    });
    expect(side.page.sheet.place).toBe(0);
    press(side, ']');
    expect(side.page.sheet.place).toBe(200);
    expect(said(side)).toBe('Highlight, 1 of 2 marks.');
    press(side, ']');
    expect(side.page.sheet.place).toBe(400);
    expect(said(side)).toBe('Bookmark, 2 of 2 marks.');
    press(side, '[');
    expect(side.page.sheet.place).toBe(200);
    press(side, '[');
    expect(side.page.sheet.place).toBe(400);
    expect(said(side)).toBe('Round to the last: Bookmark, 2 of 2 marks.');
    expect(where(side)).toBe(chapter(1));
  });

  it('keep the place each lands on as the book’s, so the book opens there again', async () => {
    const { side, writes } = await opened({
      highlights: [{ chapter: chapter(3), from: 30, to: 40, words: '' }],
    });
    press(side, ']');
    await vi.waitFor(() =>
      expect(writes).toHaveBeenLastCalledWith(expect.any(String), {
        chapter: chapter(3),
        offset: 30,
      }),
    );
  });

  it('say a bookmark and a highlight at one word as two marks, the bookmark first', async () => {
    const { side } = await opened({
      bookmarks: [{ chapter: chapter(2), offset: 20, words: '' }],
      highlights: [{ chapter: chapter(2), from: 20, to: 30, words: '' }],
    });
    press(side, ']');
    await vi.waitFor(() => expect(where(side)).toBe(chapter(2)));
    expect(said(side)).toBe('Bookmark, 1 of 2 marks.');
    // Both in sight now: [ from the chapter after goes back to the highlight, the last of the two.
    await side.go(side.spine + 1);
    press(side, '[');
    await vi.waitFor(() => expect(where(side)).toBe(chapter(2)));
    expect(said(side)).toBe('Highlight, 2 of 2 marks.');
  });
});
