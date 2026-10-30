// A book scrolls a chapter a sheet (#40, Phase 2): the chapters either side
// at its foot, how far through in the colophon, its paragraphs as the scroll
// style sets them, and its place kept in the reading state, shown again when
// it opens. Lines laid out by ./test-lines.ts.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fixtureEpubs, SAMPLE_SOURCES } from '../../../tests/support/epub-fixtures';
import { DEFAULT_SETTINGS } from '../../core/config';
import { ChapterSheet } from './chapter-sheet';
import { epubKind } from './epub-kind';
import type { EpubPage } from './epub-page';
import { REST_MS } from './place-keeper';
import { linesOf } from './test-lines';
import { sideWith } from './test-side';

const EPUBS = fixtureEpubs(SAMPLE_SOURCES);
const book = () => ({ 'a.epub': EPUBS['plain.epub'] as Uint8Array });

const scrollerOf = (page: EpubPage) => page.element.querySelector('.page__scroll') as HTMLElement;

/** The page given a height, and each word a line by where it stands among the chapter's. */
function laidOut(page: EpubPage): HTMLElement {
  const scroller = scrollerOf(page);
  Object.defineProperty(scroller, 'clientHeight', { configurable: true, get: () => 200 });
  Object.defineProperty(scroller, 'scrollHeight', { configurable: true, get: () => 2200 });
  const lines = linesOf(page.chapter, scroller);
  vi.spyOn(Range.prototype, 'getBoundingClientRect').mockImplementation(function (this: Range) {
    return lines(this) as DOMRect;
  });
  return scroller;
}

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
    await vi.waitFor(() => expect(document.activeElement).toBe(scrollerOf(side.page)));
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
    const figures = side.page.foot.figures.map((figure) => figure.textContent);
    // No step back to offer (no link followed), then the chapter's place, its page and how far through.
    expect(figures[0]).toBe('');
    expect(figures[1]).toBe('2 of 4');
    expect(figures[3]).toBe('20% of the chapter');
    expect(figures[4]).toMatch(/^\d+% of the book$/u);
  });

  it('says the printed page it’s on, at once, the book’s pages by its last (Phase 4)', async () => {
    const { side } = sideWith({ 'a.epub': EPUBS['page-list.epub'] as Uint8Array });
    await side.open('a.epub');
    const scroller = laidOut(side.page);
    const page = () => side.page.foot.figures[2]?.textContent;
    scrollTo(scroller, 0);
    vi.advanceTimersByTime(REST_MS);
    // Before the chapter's first marked page: the front matter's, named by the chapter alone.
    expect(page()).toBe('page xii of 5');
    scrollTo(scroller, 1000);
    vi.advanceTimersByTime(REST_MS);
    expect(page()).toBe('page 1 of 5');
  });

  it('says the steady page it’s on once the book is counted, nothing before (Phase 4)', async () => {
    const { side } = sideWith(book());
    await side.open('a.epub');
    const scroller = laidOut(side.page);
    const page = () => side.page.foot.figures[2]?.textContent;
    scrollTo(scroller, 0);
    vi.advanceTimersByTime(REST_MS);
    expect(page()).toBe('');
    // Each item counted in a task of its own, its chapter read meanwhile.
    for (let i = 0; i < 40 && page() === ''; i++) await vi.advanceTimersByTimeAsync(1);
    expect(page()).toBe('page 1 of 1');
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
