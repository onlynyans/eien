// A book's bookmarks on its page (#40, Phase 4b): B puts one at the first
// word in sight or takes the page's off, kept in the reading state's file
// with every other field, the page's mark and the tool following, two pages
// on one book in step, and a file this Eien won't write said so.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { fixtureEpubs, SAMPLE_SOURCES } from '../../../tests/support/epub-fixtures';
import { type Bookmark, readingPath } from '../../core/epub';
import { ChapterSheet } from './chapter-sheet';
import { makeEpubSide } from './epub-side';
import type { EpubSide } from './epub-side-types';
import { PageBookmarks } from './page-bookmarks';
import { laidOut } from './test-lines';
import { sideWith } from './test-side';
import { pageCopy } from './turn/page-copy';

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

/** One page's mark: at its outer edge, the right (a spread's verso wears the left, Phase 3d). */
const markOf = (side: EpubSide) =>
  side.page.element.querySelector<HTMLElement>('.page__mark--bookmark[data-edge="right"]');
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

  it('is taken off from its Marks row, the list told and the colophon saying so (Phase 4c)', async () => {
    const { side, file, press, changed } = await opened();
    press();
    await vi.waitFor(() => expect(side.bookmarks).toHaveLength(1));
    changed.mockClear();
    await side.unmark(side.bookmarks[0] as Bookmark);
    expect(JSON.parse((await file()) ?? '{}').bookmarks).toEqual([]);
    expect(side.bookmarks).toEqual([]);
    expect(side.bookmarked).toBe(false);
    expect(changed).toHaveBeenCalled();
    expect(said(side)).toBe('Bookmark taken off.');
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

describe('a Marks row’s bookmark, as QA tried it (Phase 4c)', () => {
  it('is gone to in another chapter: that chapter drawn at its place, kept as the place, its mark shown', async () => {
    const shown = vi.spyOn(ChapterSheet.prototype, 'showPlace');
    const { side, writes, key } = await opened(() =>
      JSON.stringify({
        bookmarks: [{ chapter: 'OEBPS/chapter-3.xhtml', offset: 40, words: 'later' }],
      }),
    );
    expect(side.spine).toBe(1);
    await side.goTo(3, 40);
    expect(side.spine).toBe(3);
    expect(shown.mock.lastCall?.[0]).toBe(40);
    expect(writes).toHaveBeenLastCalledWith(key, { chapter: 'OEBPS/chapter-3.xhtml', offset: 40 });
    await vi.waitFor(() => expect(side.bookmarked).toBe(true));
    expect(markOf(side)?.hidden).toBe(false);
  });

  it('is gone to in the chapter on the page: shown there, kept, nothing drawn again', async () => {
    const shown = vi.spyOn(ChapterSheet.prototype, 'showPlace');
    const { side, writes, key, reads } = await opened();
    const before = side.page.chapter.innerHTML;
    reads.mockClear();
    await side.goTo(1, 60);
    expect(side.spine).toBe(1);
    expect(shown).toHaveBeenLastCalledWith(60);
    expect(writes).toHaveBeenLastCalledWith(key, { chapter: CHAPTER, offset: 60 });
    expect(side.page.chapter.innerHTML).toBe(before);
  });

  it('forgets the step back a link left: a bookmark is a place chosen', async () => {
    const at = sideWith({ 'a.epub': EPUBS['links.epub'] as Uint8Array });
    await at.side.open('a.epub');
    [...at.side.page.chapter.querySelectorAll('a')]
      .find((a) => a.textContent === 'see Chapter III')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(at.side.spine).toBe(2));
    const back = at.side.page.foot.figures[0] as HTMLButtonElement;
    expect(back.hidden).toBe(false);
    await at.side.goTo(1, 0);
    expect(back.hidden).toBe(true);
  });

  it('isn’t taken off in a newer Eien’s file: it says why, never “Bookmark taken off.”, and leaves the file be', async () => {
    const newer = JSON.stringify({
      version: 2,
      bookmarks: [{ chapter: CHAPTER, offset: 300, words: 'further on' }],
    });
    const { side, file } = await opened(() => newer);
    const [mark] = side.bookmarks;
    if (!mark) throw new Error('the newer file’s bookmark wasn’t read');
    await side.unmark(mark);
    expect(said(side)).toMatch(/newer Eien/u);
    expect(await file()).toBe(newer);
    expect(side.bookmarks).toHaveLength(1);
  });

  it('taken off on one page of a book is gone from the other’s too, whose list is told', async () => {
    const first = await opened(() =>
      JSON.stringify({ bookmarks: [{ chapter: CHAPTER, offset: 300, words: 'further on' }] }),
    );
    const listed = vi.fn();
    const second = makeEpubSide(
      { ...first.of, changed: listed },
      { close: () => {}, caret: () => {} },
      null,
    );
    document.body.append(second.page.element);
    laidOut(second.page);
    await second.open('a.epub');
    expect(second.bookmarks).toHaveLength(1);
    listed.mockClear();
    await first.side.unmark(first.side.bookmarks[0] as Bookmark);
    expect(second.bookmarks).toEqual([]);
    expect(listed).toHaveBeenCalled();
  });
});

describe('a book with a thousand bookmarks, as QA tried it (Phase 4c)', () => {
  // QA (Phase 4c) found the 1,001st written and "Bookmarked." said, though the store reads back the
  // first MAX_BOOKMARKS alone: never shown, never taken off. Now B says the book is full.
  it('shows a bookmark B makes past the thousand, or says it isn’t kept: never “Bookmarked.” over a page with no mark', async () => {
    // A thousand further on in the chapter, none on the first page.
    const { side, press, file } = await opened(() =>
      JSON.stringify({
        bookmarks: Array.from({ length: 1000 }, (_, i) => ({
          chapter: CHAPTER,
          offset: 1000 + i,
          words: `${i}`,
        })),
      }),
    );
    expect(side.bookmarks).toHaveLength(1000);
    press();
    await vi.waitFor(() => expect(said(side)).not.toBe(''));
    const written = JSON.parse((await file()) ?? '{}').bookmarks;
    if (said(side) === 'Bookmarked.') {
      expect(written).toHaveLength(1001);
      expect(side.bookmarked).toBe(true);
      expect(markOf(side)?.hidden).toBe(false);
    } else expect(written).toHaveLength(1000);
    expect(said(side)).toBe('A book keeps 1,000 bookmarks at most: take one off first.');
  });
});

describe('what a page shows of its bookmarks', () => {
  it('follows a turn once it lands, never mid-turn', () => {
    const page = { bookmarked: vi.fn(), foot: { say: () => {} }, sheet: { sight: [] } };
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
      listed: () => {},
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
    // One page: its mark at its outer edge, the right.
    expect(page.bookmarked).toHaveBeenLastCalledWith(false, true);
    expect(marks.on).toBe(true);
  });
});

// QA (#40, Phase 4b): the cases the tests above leave out.

/** Lets the window's promises and timers run a moment, so a change that shouldn't come has had its chance. */
const settle = () => new Promise((done) => setTimeout(done, 20));

/** The chapter scrolled to `top` (a line is 20px of ten characters, ./test-lines.ts). */
const scrollTo = (side: EpubSide, top: number) => {
  side.page.scroller.scrollTop = top;
  side.page.scroller.dispatchEvent(new Event('scroll'));
};

describe('a bookmark while scrolling', () => {
  it('B before the scroll rests bookmarks the lines in sight now, not where it last rested', async () => {
    const { side, press, file } = await opened();
    await settle();
    // Three lines down, and B at once: the rest on its way is taken first.
    scrollTo(side, 60);
    press();
    await vi.waitFor(() => expect(side.bookmarked).toBe(true));
    const [mark] = JSON.parse((await file()) ?? '{}').bookmarks;
    expect(mark.offset).toBeGreaterThan(0);
    expect(mark.offset).toBe(side.page.sheet.place);
  });

  it('is shown only while its lines are in sight, the tool told each time', async () => {
    const { side, press, of } = await opened();
    press();
    await vi.waitFor(() => expect(side.bookmarked).toBe(true));
    vi.mocked(of.looks).mockClear();
    // Scrolled well past it, at rest: the page in sight has none.
    scrollTo(side, 600);
    side.keep();
    await vi.waitFor(() => expect(side.bookmarked).toBe(false));
    expect(markOf(side)?.hidden).toBe(true);
    expect(of.looks).toHaveBeenCalledTimes(1);
    scrollTo(side, 0);
    side.keep();
    await vi.waitFor(() => expect(side.bookmarked).toBe(true));
    expect(markOf(side)?.hidden).toBe(false);
    expect(of.looks).toHaveBeenCalledTimes(2);
  });

  it('a key held down bookmarks once', async () => {
    const { side, file } = await opened();
    for (const repeat of [false, true, true, true])
      side.page.key(new KeyboardEvent('keydown', { key: 'b', repeat }));
    await vi.waitFor(() => expect(side.bookmarked).toBe(true));
    await settle();
    expect(side.bookmarked).toBe(true);
    expect(JSON.parse((await file()) ?? '{}').bookmarks).toHaveLength(1);
  });
});

describe('a book’s reading file from before bookmarks, or naming a chapter it hasn’t', () => {
  it('a Phase 2 file gains its bookmarks beside the place, which the book still opens at', async () => {
    const { side, press, file } = await opened(() =>
      JSON.stringify({
        version: 1,
        chapter: 'OEBPS/chapter-2.xhtml',
        place: { chapter: 'OEBPS/chapter-2.xhtml', offset: 0 },
      }),
    );
    expect(side.epub?.spine[side.spine]?.path).toBe('OEBPS/chapter-2.xhtml');
    expect(side.bookmarks).toEqual([]);
    press();
    await vi.waitFor(() => expect(side.bookmarked).toBe(true));
    const after = JSON.parse((await file()) ?? '{}');
    expect(after.version).toBe(1);
    expect(after.chapter).toBe('OEBPS/chapter-2.xhtml');
    expect(after.bookmarks).toEqual([
      expect.objectContaining({ chapter: 'OEBPS/chapter-2.xhtml', offset: 0 }),
    ]);
  });

  it('never shows one on a chapter the book doesn’t have, and keeps it in the file', async () => {
    const gone = { chapter: 'OEBPS/gone.xhtml', offset: 0, words: 'a chapter since cut' };
    const { side, press, file } = await opened(() =>
      JSON.stringify({ version: 1, bookmarks: [gone] }),
    );
    await settle();
    expect(side.bookmarked).toBe(false);
    expect(markOf(side)?.hidden).toBe(true);
    // B on the page in sight makes its own, never taking the other for this page's.
    press();
    await vi.waitFor(() => expect(side.bookmarked).toBe(true));
    const kept = JSON.parse((await file()) ?? '{}').bookmarks;
    expect(kept).toHaveLength(2);
    expect(kept[0]).toEqual(gone);
  });
});

describe('a page of no words', () => {
  it('a picture alone is bookmarked at its place, with no words, and shows it', async () => {
    const at = sideWith({ 'a.epub': EPUBS['plates.epub'] as Uint8Array });
    laidOut(at.side.page);
    await at.side.open('a.epub');
    // The headpiece in Calibre's SVG frame: a picture and nothing to read.
    await at.side.go(1);
    expect(at.side.page.chapter.querySelector('img')).not.toBeNull();
    at.side.page.key(new KeyboardEvent('keydown', { key: 'b' }));
    await vi.waitFor(() => expect(at.side.bookmarked).toBe(true));
    expect(at.side.bookmarks).toEqual([{ chapter: 'framed.xhtml', offset: 0, words: '' }]);
    expect(markOf(at.side)?.hidden).toBe(false);
  });
});

describe('two pages, one book', () => {
  it('a bookmark taken off on one is gone from the other at once', async () => {
    const first = await opened();
    const second = makeEpubSide(first.of, { close: () => {}, caret: () => {} }, null);
    document.body.append(second.page.element);
    laidOut(second.page);
    await second.open('a.epub');
    first.press();
    await vi.waitFor(() => expect(second.bookmarked).toBe(true));
    second.page.key(new KeyboardEvent('keydown', { key: 'b' }));
    await vi.waitFor(() => expect(first.side.bookmarked).toBe(false));
    expect(markOf(first.side)?.hidden).toBe(true);
  });

  it('a page let go of the book, or given another, is told of its bookmarks no more', async () => {
    const first = await opened();
    const second = makeEpubSide(first.of, { close: () => {}, caret: () => {} }, null);
    document.body.append(second.page.element);
    laidOut(second.page);
    await second.open('a.epub');
    const shown = vi.spyOn(second.page, 'bookmarked');
    second.dispose();
    shown.mockClear();
    first.press();
    await vi.waitFor(() => expect(first.side.bookmarked).toBe(true));
    await settle();
    expect(shown).not.toHaveBeenCalled();
    expect(second.bookmarked).toBe(false);
  });
});

describe('a bookmark the vault won’t keep', () => {
  it('says so, never “Bookmarked.”, and the page shows none', async () => {
    const { side, press, disk } = await opened();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(disk, 'write').mockRejectedValue(new Error('the disk is full'));
    press();
    await vi.waitFor(() => expect(said(side)).toMatch(/couldn’t be kept/u));
    expect(side.bookmarked).toBe(false);
    expect(markOf(side)?.hidden).toBe(true);
  });
});

describe('B in the middle of a turn', () => {
  /** A page whose words in sight are 0–100, a turn to 100–200 in flight that tells where it lands only as it does (a hand's). */
  function turning() {
    const chapter = document.createElement('div');
    chapter.innerHTML = `<p>${'word '.repeat(60)}</p>`;
    const page = {
      bookmarked: vi.fn(),
      foot: { say: vi.fn() },
      chapter,
      sheet: { keep: vi.fn(), sight: [] },
    };
    let flying = false;
    const waiting: (() => void)[] = [];
    const mark = vi.fn(async (_key: string, change: { add?: Bookmark }) => {
      // Asked only once the turn has landed.
      expect(flying).toBe(false);
      return change.add ? [change.add] : [];
    });
    /** What the store tells this page of its book's bookmarks changed elsewhere. */
    let told: (bookmarks: readonly Bookmark[]) => void = () => {};
    const listen = (_key: string, then: typeof told) => {
      told = then;
      return () => {};
    };
    const marks: PageBookmarks = new PageBookmarks({
      page: page as never,
      store: { listen, mark } as never,
      chapter: () => CHAPTER,
      still: (then) => {
        if (flying) waiting.push(then);
        else then();
      },
      land: () => {
        if (!flying) return;
        flying = false;
        marks.inSight(100, 200);
        for (const then of waiting.splice(0)) then();
      },
      changed: () => {},
      listed: () => {},
    });
    marks.opened('k', { reading: { chapter: null, offset: 0 }, bookmarks: [], kept: 'kept' });
    marks.inSight(0, 100);
    const turn = () => {
      flying = true;
    };
    return { marks, page, mark, turn, told: (bookmarks: readonly Bookmark[]) => told(bookmarks) };
  }

  it('lands the turn first, and bookmarks the page it lands on', async () => {
    const { marks, page, mark, turn } = turning();
    turn();
    await marks.toggle();
    expect(mark).toHaveBeenCalledWith('k', {
      add: expect.objectContaining({ chapter: CHAPTER, offset: 100 }),
    });
    expect(page.sheet.keep).toHaveBeenCalled();
    expect(marks.on).toBe(true);
    // One page: its mark at its outer edge, the right.
    expect(page.bookmarked).toHaveBeenLastCalledWith(false, true);
  });

  // QA (Phase 4b) found it shown at once: a change the store tells (B on another page of the book)
  // waits for the turn to land, as the page's own do, never drawn against the page on its way.
  it('a bookmark made on another page mid-turn shows once the turn lands', () => {
    const { marks, page, turn, told } = turning();
    // A turn under way to 100–200, its landing still to come.
    turn();
    marks.inSight(100, 200);
    page.bookmarked.mockClear();
    told([{ chapter: CHAPTER, offset: 120, words: '' }]);
    expect(page.bookmarked).not.toHaveBeenCalledWith(true);
  });
});

describe('the bookmark’s mark on the page', () => {
  it('is left out of a turn’s copy of the page: the page under it shows its own once it lands', async () => {
    const { side, press } = await opened();
    press();
    await vi.waitFor(() => expect(markOf(side)?.hidden).toBe(false));
    const sheet = side.page.element.querySelector('.epub-sheet') as HTMLElement;
    const copy = pageCopy(sheet, '.epub-chapter');
    expect(copy.querySelector('.page__mark--bookmark')).toBeNull();
    expect(sheet.querySelector('.page__mark--bookmark')).not.toBeNull();
  });

  it('isn’t made by B with no book on the page', async () => {
    const { side, of } = await opened();
    // Asked of the store at all would be a bookmark made somewhere, whatever file it named.
    const mark = vi.spyOn(of.reading, 'mark');
    side.clear();
    side.page.key(new KeyboardEvent('keydown', { key: 'b' }));
    await side.bookmark();
    await settle();
    expect(mark).not.toHaveBeenCalled();
    expect(side.bookmarked).toBe(false);
  });

  it('is gone with the folio’s word when the book is closed', async () => {
    const { side, press } = await opened();
    press();
    await vi.waitFor(() => expect(side.bookmarked).toBe(true));
    side.clear();
    expect(side.bookmarked).toBe(false);
    expect(markOf(side)?.hidden).toBe(true);
    const word = side.page.foot.figures.find((each) =>
      each.classList.contains('colophon__bookmarked'),
    );
    expect(word?.textContent).toBe('');
  });
});
