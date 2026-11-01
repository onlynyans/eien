// A book scrolls a chapter a sheet (#40, Phase 2): the chapters either side
// at its foot, how far through in the colophon, its paragraphs as the scroll
// style sets them, and its place kept in the reading state, shown again when
// it opens. Lines laid out by ./test-lines.ts.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fixtureEpubs, SAMPLE_SOURCES } from '../../../tests/support/epub-fixtures';
import { handEpub, nav, opf, XHTML, page as xhtml } from '../../../tests/support/epub-parts';
import { longBook } from '../../../tests/support/long-book';
import { DEFAULT_SETTINGS } from '../../core/config';
import { bookFraction, countChapter, type Epub, isRefusal, percent } from '../../core/epub';
import { BookCount } from './book-count';
import { ChapterSheet } from './chapter-sheet';
import { epubKind } from './epub-kind';
import type { EpubPage } from './epub-page';
import { makeEpubSide } from './epub-side';
import type { EpubSide } from './epub-side-types';
import { REST_MS } from './place-keeper';
import { laidOut } from './test-lines';
import { sideWith } from './test-side';

const EPUBS = fixtureEpubs(SAMPLE_SOURCES);
const book = () => ({ 'a.epub': EPUBS['plain.epub'] as Uint8Array });

/** The real setTimeout, taken before the tests fake it: a book's chapters inflate in real time. */
const realTimeout = globalThis.setTimeout.bind(globalThis);

const scrollTo = (scroller: HTMLElement, top: number) => {
  scroller.scrollTop = top;
  scroller.dispatchEvent(new Event('scroll'));
};

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame'],
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe('a chapter’s foot', () => {
  it('names the chapters either side, the title page by its place, and says the end at the last', async () => {
    const { side } = sideWith(book());
    await side.open('a.epub');
    const turns = () =>
      [...side.page.element.querySelectorAll('.sheet__turns > *')].map((each) => [
        each.textContent,
        each.getAttribute('aria-label'),
      ]);
    // Chapter I: the title page before it, which the contents don't name.
    expect(turns()).toEqual([
      ['Previous chapter', 'Previous chapter'],
      ['Chapter II', 'Next chapter: Chapter II'],
    ]);
    await side.go(3);
    expect(turns()).toEqual([
      ['Chapter II', 'Previous chapter: Chapter II'],
      ['The end', null],
    ]);
    expect(side.page.element.querySelector('nav.sheet__turns')?.getAttribute('aria-label')).toBe(
      'Chapters',
    );
  });

  it('draws the chapter pressed at its top, kept as the place, the keyboard staying on the page', async () => {
    vi.useRealTimers();
    const { side, writes } = sideWith(book());
    await side.open('a.epub');
    const next = side.page.element.querySelector<HTMLButtonElement>('[data-turn="next"]');
    next?.focus();
    next?.click();
    await vi.waitFor(() => expect(side.spine).toBe(2));
    expect(writes).toHaveBeenLastCalledWith(expect.any(String), {
      chapter: 'OEBPS/chapter-2.xhtml',
      offset: 0,
    });
    await vi.waitFor(() => expect(document.activeElement).toBe(side.page.scroller));
  });
});

describe('the place in a chapter', () => {
  it('is kept in the reading state once the scroll rests, and said in the colophon as it moves', async () => {
    const { side, writes } = sideWith(book());
    await side.open('a.epub');
    const scroller = laidOut(side.page);
    writes.mockClear();
    scrollTo(scroller, 400);
    vi.advanceTimersByTime(REST_MS);
    expect(writes).toHaveBeenCalledExactlyOnceWith(side.epub?.key, {
      chapter: 'OEBPS/chapter-1.xhtml',
      offset: 200,
    });
    expect(side.place).toMatchObject({ spine: 1, offset: 200 });
    // Read by their kinds, as the colophon's figures come and go by phase.
    const figure = (kind: string) =>
      side.page.foot.figures.find((each) => each.classList.contains(kind))?.textContent;
    // No step back to offer (no link followed), then the chapter's place and how far through.
    expect(side.page.foot.figures[0]?.textContent).toBe('');
    expect(figure('colophon__chapter')).toBe('2 of 4');
    expect(figure('colophon__bookmarked')).toBe('');
    const through = side.page.foot.figures.filter((each) =>
      each.classList.contains('colophon__through'),
    );
    // Where in the chapter, scrolling, in the page's place (#67); the book's alone after it.
    expect(figure('colophon__page')).toBe('20% of the chapter');
    expect(through.map((each) => each.textContent)).toEqual([
      expect.stringMatching(/^\d+% of the book$/u),
    ]);
  });

  it('says the printed page it’s on, at once, the book’s pages by its last (Phase 4)', async () => {
    const { side } = sideWith({ 'a.epub': EPUBS['page-list.epub'] as Uint8Array });
    await side.open('a.epub');
    const scroller = laidOut(side.page);
    const page = () =>
      side.page.foot.figures.find((each) => each.classList.contains('colophon__page'))?.textContent;
    scrollTo(scroller, 0);
    vi.advanceTimersByTime(REST_MS);
    // Before the chapter's first marked page: the front matter's, named by the chapter alone.
    expect(page()).toBe('page xii of 5');
    scrollTo(scroller, 1000);
    vi.advanceTimersByTime(REST_MS);
    expect(page()).toBe('page 1 of 5');
  });

  it('says how far through the chapter with no page-list, at once, none of it waiting on the count (#67)', async () => {
    const { side } = sideWith(book());
    await side.open('a.epub');
    const scroller = laidOut(side.page);
    const page = () =>
      side.page.foot.figures.find((each) => each.classList.contains('colophon__page'))?.textContent;
    scrollTo(scroller, 0);
    vi.advanceTimersByTime(REST_MS);
    expect(page()).toBe('0% of the chapter');
    scrollTo(scroller, 1000);
    // Told on the next frame, as it scrolls.
    vi.advanceTimersByTime(20);
    expect(page()).toBe('50% of the chapter');
    // At rest, its lines measured again: still the chapter's share, never a page of the book.
    vi.advanceTimersByTime(REST_MS);
    expect(page()).toBe('50% of the chapter');
  });

  it('is shown again when the book opens, from the reading state or the place a page left', async () => {
    const shown = vi.spyOn(ChapterSheet.prototype, 'showPlace');
    const { side, kept, of } = sideWith(book());
    await side.open('a.epub');
    kept.set(side.epub?.key ?? '', { chapter: 'OEBPS/chapter-3.xhtml', offset: 120 });
    const again = (await import('./epub-side')).makeEpubSide(
      of,
      { close: () => {}, caret: () => {} },
      null,
    );
    await again.open('a.epub');
    expect(again.spine).toBe(3);
    expect(shown).toHaveBeenLastCalledWith(120);
    // ⇄: the place a page left, its chapter and line.
    await again.open('a.epub', { path: 'a.epub', name: '', spine: 2, offset: 40 } as never);
    expect(again.spine).toBe(2);
    expect(shown).toHaveBeenLastCalledWith(40);
    await again.open('a.epub', { path: 'a.epub', name: '', spine: 2, offset: 70 } as never);
    expect(shown).toHaveBeenLastCalledWith(70);
  });

  it('asked for before it rests (a quote, ⇄), is the line now, not the last rest', async () => {
    const { side } = sideWith(book());
    await side.open('a.epub');
    const scroller = laidOut(side.page);
    scrollTo(scroller, 400);
    expect(side.place).toMatchObject({ spine: 1, offset: 200 });
  });

  it('on its way to rest, is kept when the window quits', async () => {
    const { side, writes, of } = sideWith(book());
    await side.open('a.epub');
    const scroller = laidOut(side.page);
    writes.mockClear();
    scrollTo(scroller, 400);
    await epubKind(of).flush([side]);
    expect(writes).toHaveBeenCalledExactlyOnceWith(expect.any(String), {
      chapter: 'OEBPS/chapter-1.xhtml',
      offset: 200,
    });
  });
});

// QA (#40, Phase 4a; #67): a place named by how far through the book, as a
// row names it, over a book of several chapters, two pages on one book, a
// book opened again, and a chapter that won't open.
describe('a place in a whole book, as a row names it', () => {
  /** A chapter's top, as a Marks row names it: how far through the book, once it's counted. */
  const rowSaid = (side: EpubSide, spine = 0) => side.labelAt(spine, 0) ?? '';
  /**
   * The count's tasks run, each chapter read meanwhile, until `done`. Reading a chapter inflates
   * it in real time, so each step also gives the real clock a turn, and the wait is bounded by
   * real time, not a number of steps (a loaded CI machine took more than 400).
   */
  const until = async (done: () => boolean) => {
    const deadline = Date.now() + 10_000;
    while (!done() && Date.now() < deadline) {
      await vi.advanceTimersByTimeAsync(1);
      await new Promise((resolve) => realTimeout(resolve, 0));
    }
    expect(done()).toBe(true);
  };
  /** The page at rest at its top, its lines in sight measured. */
  const atRest = (page: EpubPage) => {
    const scroller = laidOut(page);
    scrollTo(scroller, 0);
    vi.advanceTimersByTime(REST_MS);
  };
  /** Each chapter's length as a place counts it, read again here. */
  const lengthsOf = async (epub: Epub) =>
    Promise.all(
      epub.spine.map(async (_, i) => {
        const chapter = await epub.chapter(i);
        return isRefusal(chapter) ? 0 : countChapter(chapter.nodes).length;
      }),
    );

  it('names a later chapter’s place by how far through the book, by the chapters before it', async () => {
    const { side } = sideWith({ 'a.epub': longBook({ chapters: 4, paragraphs: 30 }) });
    await side.open('a.epub');
    atRest(side.page);
    const epub = side.epub as Epub;
    await until(() => rowSaid(side, 3) !== '');
    expect(rowSaid(side)).toBe('0%');
    const lengths = await lengthsOf(epub);
    expect(side.labelAt(3, Math.floor((lengths[3] as number) / 2))).toBe(
      percent(bookFraction(epub.spine, 3, 0.5)),
    );
    expect(rowSaid(side, 3)).not.toBe('0%');
  });

  it('says the page at once on a second page of the same book: one count, not two', async () => {
    const { side, of } = sideWith(book());
    await side.open('a.epub');
    atRest(side.page);
    await until(() => rowSaid(side) !== '');
    const again = makeEpubSide(of, { close: () => {}, caret: () => {} }, null);
    document.body.append(again.page.element);
    await again.open('a.epub');
    atRest(again.page);
    // No count's task has run for it (each reads a chapter, which takes more than a timer's tick):
    // the window's count of the book was whole already, and is the one both pages read.
    expect(rowSaid(again)).toBe('0%');
    expect(of.counts.of(again.epub as Epub)).toBe(of.counts.of(side.epub as Epub));
  });

  it('says the page at once when the book is opened again on its page', async () => {
    const { side } = sideWith(book());
    await side.open('a.epub');
    atRest(side.page);
    await until(() => rowSaid(side) !== '');
    side.clear();
    expect(rowSaid(side)).toBe('');
    const runs = vi.spyOn(BookCount.prototype, 'run');
    await side.open('a.epub');
    atRest(side.page);
    expect(rowSaid(side)).toBe('0%');
    // Asked to go on, it had nothing left to read.
    expect(runs).toHaveBeenCalledOnce();
    expect((runs.mock.contexts[0] as BookCount).whole).toBe(true);
  });

  it('says nothing of where on a chapter that won’t open, which counts as no words', async () => {
    const { side, of } = sideWith({ 'a.epub': brokenMiddle() });
    await side.open('a.epub');
    atRest(side.page);
    const count = of.counts.of(side.epub as Epub);
    await until(() => count.whole);
    expect(count.lengths[1]).toBe(0);
    const pageSaid = () => side.page.foot.figures[2]?.textContent;
    expect(pageSaid()).toBe('0% of the chapter');
    await side.go(1);
    expect(pageSaid()).toBe('');
    await side.go(2);
    atRest(side.page);
    expect(pageSaid()).toBe('0% of the chapter');
    // Its places named at its start, where it stands in the book: the broken chapter takes its room.
    expect(rowSaid(side, 2)).toBe(percent(bookFraction((side.epub as Epub).spine, 2, 0)));
  });
});

/** A book of three chapters whose second won't inflate: its bytes in the zip aren't deflate's. */
function brokenMiddle(): Uint8Array {
  const chapter = (n: number) =>
    xhtml(`Chapter ${n}`, `<h1>Chapter ${n}</h1>\n${'<p>Words enough to count.</p>'.repeat(80)}`);
  return handEpub('content.opf', [
    {
      name: 'content.opf',
      data: opf(
        '3.0',
        [
          { id: 'nav', href: 'nav.xhtml', type: XHTML, properties: 'nav' },
          ...['c0', 'c1', 'c2'].map((id) => ({ id, href: `${id}.xhtml`, type: XHTML })),
        ],
        ['c0', 'c1', 'c2'],
      ),
    },
    {
      name: 'nav.xhtml',
      data: nav([
        ['One', 'c0.xhtml'],
        ['Two', 'c1.xhtml'],
        ['Three', 'c2.xhtml'],
      ]),
    },
    { name: 'c0.xhtml', data: chapter(1) },
    { name: 'c1.xhtml', data: chapter(2), packed: new Uint8Array([0xff, 0xff, 0xff, 0xff]) },
    { name: 'c2.xhtml', data: chapter(3) },
  ]);
}

describe('the scroll style', () => {
  it('is worn on the book’s leaf, as a note’s or as a book’s', async () => {
    const { side } = sideWith(book());
    await side.open('a.epub');
    side.follow(DEFAULT_SETTINGS);
    expect(side.page.element.dataset.scroll).toBe('note');
    side.follow({ ...DEFAULT_SETTINGS, 'epub.scroll': 'book' });
    expect(side.page.element.dataset.scroll).toBe('book');
  });
});
