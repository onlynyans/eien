// Find in a book (#40, Phase 5c), over a real page: the page's own find bar
// (the window's, as a note's) searching the whole book, its count, next and
// previous across chapters and round, every match in the chapter drawn inked
// and the one it's on inked apart, chosen on the page as the bar closes;
// the bar's options; and what a book takes from a page's find: no Replace.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { fixtureEpubs, SAMPLE_SOURCES } from '../../../tests/support/epub-fixtures';
import type { EpubSide } from './epub-side-types';
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
});
