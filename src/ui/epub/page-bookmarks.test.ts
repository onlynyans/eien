// A book's bookmarks on its page (#40, Phase 4b): B puts one at the first
// word in sight or takes the page's off, kept in the reading state's file
// with every other field, the page's mark and the tool following, two pages
// on one book in step, and a file this Eien won't write said so.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { fixtureEpubs, SAMPLE_SOURCES } from '../../../tests/support/epub-fixtures';
import { readingPath } from '../../core/epub';
import { makeEpubSide } from './epub-side';
import type { EpubSide } from './epub-side-types';
import { PageBookmarks } from './page-bookmarks';
import { laidOut } from './test-lines';
import { sideWith } from './test-side';

const EPUBS = fixtureEpubs(SAMPLE_SOURCES);
const CHAPTER = 'OEBPS/chapter-1.xhtml';

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

/** A book open on a page laid out, its reading file `before` (if any) in the vault first. */
async function opened(before?: (key: string) => string) {
  const at = sideWith({ 'a.epub': EPUBS['plain.epub'] as Uint8Array });
  laidOut(at.side.page);
  // The book's key, read from a first open, so its file can be there before the real one.
  if (before) {
    const peek = sideWith({ 'a.epub': EPUBS['plain.epub'] as Uint8Array });
    await peek.side.open('a.epub');
    const key = peek.side.epub?.key ?? '';
    peek.side.dispose();
    await at.disk.write(readingPath(key), before(key), null);
  }
  await at.side.open('a.epub');
  const key = at.side.epub?.key ?? '';
  const file = async () => (await at.disk.read(readingPath(key)))?.text ?? null;
  const press = (target?: HTMLElement) => {
    const event = new KeyboardEvent('keydown', { key: 'b', bubbles: true, cancelable: true });
    (target ?? at.side.page.element).dispatchEvent(event);
    at.side.page.key(event);
  };
  return { ...at, key, file, press };
}

const markOf = (side: EpubSide) =>
  side.page.element.querySelector<HTMLElement>('.page__mark--bookmark');
const said = (side: EpubSide) => side.page.foot.said.textContent;

describe('a book’s bookmark', () => {
  it('B puts one at the first word in sight, with its words; B again takes it off', async () => {
    const { side, file, press, of } = await opened();
    expect(side.bookmarked).toBe(false);
    expect(markOf(side)?.hidden).toBe(true);
    press();
    await vi.waitFor(() => expect(side.bookmarked).toBe(true));
    const [mark] = JSON.parse((await file()) ?? '{}').bookmarks;
    expect(mark).toMatchObject({ chapter: CHAPTER, offset: 0 });
    expect(mark.words).toMatch(/^Chapter I It is a truth universally/u);
    expect(mark.words.length).toBeLessThanOrEqual(91);
    // The page wears the mark and the folio's word, the tool is told, the colophon says so.
    expect(markOf(side)?.hidden).toBe(false);
    expect(
      side.page.foot.figures.find((each) => each.classList.contains('colophon__bookmarked'))
        ?.textContent,
    ).toBe('bookmarked');
    expect(of.looks).toHaveBeenCalled();
    expect(said(side)).toBe('Bookmarked.');
    press();
    await vi.waitFor(() => expect(side.bookmarked).toBe(false));
    expect(JSON.parse((await file()) ?? '{}').bookmarks).toEqual([]);
    expect(markOf(side)?.hidden).toBe(true);
    expect(said(side)).toBe('Bookmark taken off.');
  });

  it('takes every bookmark on the page off at once, and keeps the rest and what it doesn’t know', async () => {
    const { side, file, press } = await opened(() =>
      JSON.stringify({
        version: 1,
        later: 'kept',
        bookmarks: [
          { chapter: CHAPTER, offset: 0, words: 'one' },
          { chapter: CHAPTER, offset: 40, words: 'two' },
          { chapter: CHAPTER, offset: 300, words: 'further on' },
        ],
      }),
    );
    await vi.waitFor(() => expect(side.bookmarked).toBe(true));
    press();
    await vi.waitFor(() => expect(side.bookmarked).toBe(false));
    const after = JSON.parse((await file()) ?? '{}');
    expect(after.bookmarks.map((mark: { words: string }) => mark.words)).toEqual(['further on']);
    expect(after.later).toBe('kept');
  });

  it('is never made from a field, nor by ⌘B or Ctrl+B, only by B', async () => {
    const { side, press, file } = await opened();
    const field = document.createElement('input');
    side.page.element.append(field);
    press(field);
    for (const mod of [{ metaKey: true }, { ctrlKey: true }])
      side.page.key(new KeyboardEvent('keydown', { key: 'b', ...mod }));
    await new Promise((done) => setTimeout(done, 20));
    expect(await file()).toBeNull();
    press();
    await vi.waitFor(() => expect(side.bookmarked).toBe(true));
  });

  it('two quick presses undo each other: the second waits for the first', async () => {
    const { side, press, file } = await opened();
    press();
    press();
    await vi.waitFor(() => expect(said(side)).toBe('Bookmark taken off.'));
    expect(side.bookmarked).toBe(false);
    expect(JSON.parse((await file()) ?? '{}').bookmarks).toEqual([]);
  });

  it('shows on no chapter that won’t open, and is never made there', async () => {
    const { side, press, file } = await opened();
    press();
    await vi.waitFor(() => expect(side.bookmarked).toBe(true));
    const epub = side.epub;
    if (!epub) throw new Error('no book');
    vi.spyOn(epub, 'chapter').mockResolvedValue({ refused: 'damaged', detail: 'test' });
    await side.go(2);
    expect(markOf(side)?.hidden).toBe(true);
    expect(side.bookmarked).toBe(false);
    press();
    await new Promise((done) => setTimeout(done, 20));
    expect(JSON.parse((await file()) ?? '{}').bookmarks).toHaveLength(1);
  });

  it('shows on another page of the same book at once', async () => {
    const first = await opened();
    const second = makeEpubSide(first.of, { close: () => {}, caret: () => {} }, null);
    document.body.append(second.page.element);
    laidOut(second.page);
    await second.open('a.epub');
    first.press();
    await vi.waitFor(() => expect(second.bookmarked).toBe(true));
    expect(markOf(second)?.hidden).toBe(false);
  });

  it('is shown when the book opens at a place it’s given, as by ⇄', async () => {
    const at = sideWith({ 'a.epub': EPUBS['plain.epub'] as Uint8Array });
    laidOut(at.side.page);
    await at.side.open('a.epub');
    at.side.page.key(new KeyboardEvent('keydown', { key: 'b' }));
    await vi.waitFor(() => expect(at.side.bookmarked).toBe(true));
    const again = makeEpubSide(at.of, { close: () => {}, caret: () => {} }, null);
    document.body.append(again.page.element);
    laidOut(again.page);
    await again.open('a.epub', at.side.place ?? undefined);
    await vi.waitFor(() => expect(again.bookmarked).toBe(true));
  });

  it('isn’t kept in a newer Eien’s file, and says so', async () => {
    const newer = JSON.stringify({ version: 2, bookmarks: [] });
    const { side, press, file } = await opened(() => newer);
    press();
    await vi.waitFor(() => expect(said(side)).toMatch(/newer Eien/u));
    expect(side.bookmarked).toBe(false);
    expect(await file()).toBe(newer);
  });

  it('says at open that a file it can’t read keeps nothing, and again on B, never writing over it', async () => {
    const { side, press, file } = await opened(() => '{ "bookmarks": [ broken');
    expect(said(side)).toMatch(/can’t be read/u);
    side.page.foot.say('');
    press();
    await vi.waitFor(() => expect(said(side)).toMatch(/can’t be read/u));
    expect(side.bookmarked).toBe(false);
    expect(await file()).toBe('{ "bookmarks": [ broken');
  });
});

describe('what a page shows of its bookmarks', () => {
  it('follows a turn once it lands, never mid-turn', () => {
    const page = { bookmarked: vi.fn(), foot: { say: () => {} } };
    let landed = () => {};
    const marks = new PageBookmarks({
      page: page as never,
      store: { listen: () => () => {} } as never,
      chapter: () => CHAPTER,
      still: (then) => {
        landed = then;
      },
      land: () => {},
      changed: () => {},
    });
    marks.opened('k', {
      reading: { chapter: null, offset: 0 },
      bookmarks: [{ chapter: CHAPTER, offset: 120, words: '' }],
      kept: 'kept',
    });
    page.bookmarked.mockClear();
    marks.inSight(100, 200);
    expect(page.bookmarked).not.toHaveBeenCalled();
    landed();
    expect(page.bookmarked).toHaveBeenLastCalledWith(true);
    expect(marks.on).toBe(true);
  });
});
