// Find in a book (#40, Phase 5c), over a real page: the page's own find bar
// (the window's, as a note's) searching the whole book, its count, next and
// previous across chapters and round, every match in the chapter drawn inked
// and the one it's on inked apart, chosen on the page as the bar closes;
// the bar's options; and what a book takes from a page's find: no Replace.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { fixtureEpubs, SAMPLE_SOURCES } from '../../../tests/support/epub-fixtures';
import {
  AS_WRITTEN,
  chapterBlocks,
  type Found,
  findIn,
  isRefusal,
  matcherOf,
} from '../../core/epub';
import { walked } from './chapter-range';
import type { EpubSide } from './epub-side-types';
import { INKED, inkCopy } from './ink';
import { inked, inkRanges, withInk } from './test-ink';
import { laidOut } from './test-lines';
import { sideWith } from './test-side';

const EPUBS = fixtureEpubs(SAMPLE_SOURCES);
const chapter = (n: number) => `OEBPS/chapter-${n}.xhtml`;

withInk();

/** The pages a test opened: let go after it, so no search of theirs runs on into the next. */
const opens: EpubSide[] = [];

afterEach(() => {
  for (const side of opens.splice(0)) side.dispose();
  vi.restoreAllMocks();
  document.getSelection()?.removeAllRanges();
  document.body.replaceChildren();
});

async function opened() {
  const at = sideWith({ 'a.epub': EPUBS['plain.epub'] as Uint8Array });
  laidOut(at.side.page);
  opens.push(at.side);
  await at.side.open('a.epub');
  return at;
}

const bar = (side: EpubSide) => side.page.element.querySelector<HTMLElement>('.find');
const field = (side: EpubSide) =>
  side.page.element.querySelector<HTMLInputElement>('.find__query') as HTMLInputElement;
const count = (side: EpubSide) =>
  side.page.element.querySelector('.find__count')?.textContent ?? '';
const where = (side: EpubSide) => side.epub?.spine[side.spine]?.path;

/** `words` typed in the bar's field, as a hand types them. */
function type(side: EpubSide, words: string): void {
  field(side).value = words;
  field(side).dispatchEvent(new Event('input', { bubbles: true }));
}

/** How many times `words` stand in the book's chapters (the fixture's text, as written). */
const timesIn = (words: string) =>
  SAMPLE_SOURCES.chapters.flat().join('\n').split(words).length - 1;

describe('Find in a book', () => {
  it('opens the window’s find bar over the book, with no Replace, the keyboard in its field', async () => {
    const { side } = await opened();
    side.page.find.open(false);
    expect(bar(side)?.hidden).toBe(false);
    expect(document.activeElement).toBe(field(side));
    expect(side.page.element.querySelector('.find__replace')).toBeNull();
    expect(bar(side)?.getAttribute('aria-label')).toBe('Find in the book');
  });

  it('counts every match in the whole book, and goes to the first past the place as it’s typed', async () => {
    const { side } = await opened();
    side.page.find.open(false);
    type(side, 'Bennet');
    const total = timesIn('Bennet');
    expect(total).toBeGreaterThan(2);
    await vi.waitFor(() => expect(count(side)).toBe(`1 of ${total}`));
    expect(where(side)).toBe(chapter(1));
    expect(inked('epub-found-current')).toEqual(['Bennet']);
    expect(inked('epub-found').length).toBeGreaterThan(0);
  });

  it('goes on across chapters and round the book, and back', async () => {
    const { side } = await opened();
    side.page.find.open(false);
    type(side, 'Bennet');
    const total = timesIn('Bennet');
    // Enough to cross the chapters: each chapter holds some.
    expect(total).toBeGreaterThan(SAMPLE_SOURCES.chapters.length);
    await vi.waitFor(() => expect(count(side)).toBe(`1 of ${total}`));
    const chapters = new Set<string | undefined>([where(side)]);
    for (let i = 2; i <= total; i++) {
      side.page.find.next();
      await vi.waitFor(() => expect(count(side)).toBe(`${i} of ${total}`));
      chapters.add(where(side));
    }
    expect(chapters.size).toBeGreaterThan(1);
    side.page.find.next();
    await vi.waitFor(() => expect(count(side)).toBe(`1 of ${total}`));
    side.page.find.previous();
    await vi.waitFor(() => expect(count(side)).toBe(`${total} of ${total}`));
    expect(inked('epub-found-current')).toEqual(['Bennet']);
  });

  it('chooses the match it was on as the bar closes, the ink let go, the keyboard on the page', async () => {
    const { side } = await opened();
    side.page.find.open(false);
    type(side, 'a truth');
    await vi.waitFor(() => expect(count(side)).toMatch(/^1 of /u));
    field(side).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(bar(side)?.hidden).toBe(true);
    expect(document.getSelection()?.toString()).toBe('a truth');
    expect(inked('epub-found')).toEqual([]);
    expect(inked('epub-found-current')).toEqual([]);
    expect(side.page.element.contains(document.activeElement)).toBe(true);
  });

  it('matches case and whole words as the bar asks, and says a pattern that can’t be read', async () => {
    const { side } = await opened();
    side.page.find.open(false);
    const option = (label: string) =>
      side.page.element.querySelector<HTMLButtonElement>(`.find__options [aria-label="${label}"]`);
    type(side, 'bennet');
    await vi.waitFor(() => expect(count(side)).toMatch(/of/u));
    option('Match case')?.click();
    await vi.waitFor(() => expect(count(side)).toBe('No matches'));
    option('Match case')?.click();
    option('Pattern (regular expression)')?.click();
    type(side, '(');
    await vi.waitFor(() => expect(count(side)).toBe('Not a valid pattern'));
  });

  it('seeds the field with the words chosen in the book', async () => {
    const { side } = await opened();
    const words = side.page.chapter.querySelector('p')?.firstChild as Text;
    const range = document.createRange();
    range.setStart(words, 0);
    range.setEnd(words, 5);
    document.getSelection()?.addRange(range);
    side.page.find.open(false);
    expect(field(side).value).toBe(words.data.slice(0, 5));
  });

  it('forgets what it found when another book comes to the page', async () => {
    const { side } = await opened();
    side.page.find.open(false);
    type(side, 'Bennet');
    await vi.waitFor(() => expect(count(side)).toMatch(/^1 of /u));
    side.clear();
    expect(bar(side)?.hidden).toBe(true);
    expect(inked('epub-found')).toEqual([]);
  });

  it('scrolls the match it goes to clear of the bar, which lies over the page’s top', async () => {
    const { side } = await opened();
    side.page.find.open(false);
    const BAR = 60;
    (bar(side) as HTMLElement).getBoundingClientRect = () => ({ top: 0, bottom: BAR }) as DOMRect;
    type(side, 'Bennet');
    const total = timesIn('Bennet');
    await vi.waitFor(() => expect(count(side)).toBe(`1 of ${total}`));
    const scroller = side.page.scroller;
    let under = 0;
    for (let i = 2; i <= total; i++) {
      side.page.find.next();
      await vi.waitFor(() => expect(count(side)).toBe(`${i} of ${total}`));
      const [current] = inkRanges('epub-found-current');
      const top = current?.getBoundingClientRect().top ?? 0;
      // Its line just under the bar, or the chapter at its top where it can scroll no higher.
      expect(top === BAR || scroller.scrollTop === 0, `match ${i} at ${top}`).toBe(true);
      if (top === BAR) under++;
    }
    // Most matches stand deep in their chapters: under the bar, not merely at a chapter's top.
    expect(under).toBeGreaterThan(total / 2);
  });

  it('goes first to the match at or past the place, from a later chapter, and Previous waits for the search to look back', async () => {
    const { side } = await opened();
    await side.go(3);
    const third = where(side);
    side.page.find.open(false);
    type(side, 'Bennet');
    const total = timesIn('Bennet');
    await vi.waitFor(() => expect(count(side)).toMatch(new RegExp(`^\\d+ of ${total}$`, 'u')));
    // Not the book's first match: the first in the chapter it's on.
    expect(Number(count(side).split(' of ')[0])).toBeGreaterThan(1);
    expect(where(side)).toBe(third);
  });
});

describe('Find in a book, as QA tried it (Phase 5c)', () => {
  /** The spine item of chapter `n`'s file. */
  const spineOf = (side: EpubSide, n: number) =>
    side.epub?.spine.findIndex((item) => item.path === chapter(n)) ?? -1;

  /** Every match of `words` (as written) in chapter `n`, as the book's search finds them. */
  async function matchesIn(side: EpubSide, n: number, words: string): Promise<Found[]> {
    const spine = spineOf(side, n);
    const read = await side.epub?.chapter(spine);
    if (!read || isRefusal(read)) throw new Error('no chapter');
    return findIn(chapterBlocks(read.nodes), matcherOf(words, AS_WRITTEN) as RegExp, spine);
  }

  it('says there are none, and goes nowhere on the next or the one before', async () => {
    const { side } = await opened();
    side.page.find.open(false);
    type(side, 'zebra crossing');
    await vi.waitFor(() => expect(count(side)).toBe('No matches'));
    expect(side.find.next()).toBe(false);
    expect(side.find.previous()).toBe(false);
    expect(where(side)).toBe(chapter(1));
    expect(inked('epub-found-current')).toEqual([]);
  });

  it('opens the bar on the next match with nothing typed, the keyboard in its field', async () => {
    const { side } = await opened();
    expect(bar(side)?.hidden).toBe(true);
    side.page.find.next();
    expect(bar(side)?.hidden).toBe(false);
    expect(document.activeElement).toBe(field(side));
  });

  // QA (Phase 5c) found matches found within 100 ms of the last tell unheard until a later slice, the
  // bar saying "No matches" meanwhile. Fixed: a trailing tell once the pause is up.
  it('counts the matches found so far while the book is still searched', async () => {
    const { side } = await opened();
    const epub = side.epub;
    if (!epub) throw new Error('no book');
    const last = spineOf(side, 3);
    const read = epub.chapter.bind(epub);
    let release: () => void = () => {};
    const held = new Promise<void>((done) => {
      release = done;
    });
    vi.spyOn(epub, 'chapter').mockImplementation(async (index) => {
      if (index === last) await held;
      return read(index);
    });
    side.page.find.open(false);
    type(side, 'Bennet');
    const total = timesIn('Bennet');
    const inLast = SAMPLE_SOURCES.chapters[2]?.join('\n').split('Bennet').length ?? 1;
    // The last chapter's matches still to come: the count is the rest's, and grows once it's read.
    await vi.waitFor(() => expect(count(side)).toBe(`1 of ${total - (inLast - 1)}`));
    release();
    await vi.waitFor(() => expect(count(side)).toBe(`1 of ${total}`));
  });

  it('goes on typing to the first match at or past the place, not merely in its chapter', async () => {
    const { side } = await opened();
    side.page.find.open(false);
    type(side, 'Bennet');
    // On to chapter II's one "Bennet", past chapter I's.
    const total = timesIn('Bennet');
    await vi.waitFor(() => expect(count(side)).toBe(`1 of ${total}`));
    while (where(side) !== chapter(2)) {
      const before = count(side);
      side.find.next();
      await vi.waitFor(() => expect(count(side)).not.toBe(before));
    }
    // "Mr. B": chapter II's "Mr. Bennet" begins before the place, its "Mr. Bingley" after.
    type(side, 'Mr. B');
    const mrB = timesIn('Mr. B');
    const inFirst = (SAMPLE_SOURCES.chapters[0]?.join('\n').split('Mr. B').length ?? 1) - 1;
    await vi.waitFor(() => expect(count(side)).toBe(`${inFirst + 2} of ${mrB}`));
    expect(where(side)).toBe(chapter(2));
    expect(inked('epub-found-current')).toEqual(['Mr. B']);
  });

  it('goes back from the place with none chosen yet, round to the book’s last match', async () => {
    const { side } = await opened();
    const words = [...side.page.chapter.querySelectorAll('p')]
      .map((p) => p.firstChild)
      .find((node): node is Text => node instanceof Text && node.data.includes('Bennet'));
    if (!words) throw new Error('no Bennet');
    const range = document.createRange();
    const at = words.data.indexOf('Bennet');
    range.setStart(words, at);
    range.setEnd(words, at + 'Bennet'.length);
    document.getSelection()?.addRange(range);
    // Seeded from the words chosen: opened, not typed, so Find stands on none of them yet.
    side.page.find.open(false);
    const total = timesIn('Bennet');
    await vi.waitFor(() => expect(count(side)).toBe(`${total} matches`));
    side.find.previous();
    await vi.waitFor(() => expect(count(side)).toBe(`${total} of ${total}`));
    expect(where(side)).toBe(chapter(3));
  });

  it('chooses nothing as the bar closes when its match is in a chapter no longer drawn', async () => {
    const { side } = await opened();
    side.page.find.open(false);
    // Near the chapter's top: its offsets stand among chapter III's words too.
    type(side, 'truth universally');
    await vi.waitFor(() => expect(count(side)).toBe('1 of 1'));
    expect(where(side)).toBe(chapter(1));
    await side.go(spineOf(side, 3));
    field(side).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(bar(side)?.hidden).toBe(true);
    expect(document.getSelection()?.toString()).toBe('');
    expect(side.page.element.contains(document.activeElement)).toBe(true);
  });

  it('inks a turn’s copy of the page with the chapter’s matches while the bar is open, and not after', async () => {
    const { side } = await opened();
    side.page.find.open(false);
    type(side, 'Bennet');
    await vi.waitFor(() => expect(count(side)).toMatch(/^1 of /u));
    const copyOf = () => side.page.chapter.cloneNode(true) as HTMLElement;
    const copy = copyOf();
    inkCopy(walked(copy), 0, side.find.copySpans());
    const words = [...copy.querySelectorAll(`[${INKED}="epub-found"]`)].map(
      (each) => each.textContent,
    );
    expect(words).toEqual(inked('epub-found'));
    expect(words.length).toBe(
      (SAMPLE_SOURCES.chapters[0]?.join('\n').split('Bennet').length ?? 1) - 1,
    );
    side.find.close();
    const shut = copyOf();
    inkCopy(walked(shut), 0, side.find.copySpans());
    expect(shut.querySelector(`[${INKED}]`)).toBeNull();
  });

  it('goes to a Found row’s match in another chapter, drawing it and choosing its words', async () => {
    const { side } = await opened();
    const [match] = await matchesIn(side, 3, 'Sir William');
    if (!match) throw new Error('no match');
    await side.find.goToMatch(match, true);
    expect(where(side)).toBe(chapter(3));
    expect(document.getSelection()?.toString()).toBe('Sir William');
    // The bar never opened: nothing inked, the words chosen alone.
    expect(bar(side)?.hidden).toBe(true);
    expect(inked('epub-found')).toEqual([]);
  });
});
