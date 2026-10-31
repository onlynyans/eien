// A book's highlights on its page (#40, Phase 5a), over a real page and a
// vault in memory: H keeps the words chosen and takes off the highlight they
// lie in, Put back restores it, each inked and ticked on the page and kept in
// the reading file beside what's there; read again when the book opens; and
// what can't be shown (another chapter's, one gone, past the words) never
// painted, never thrown over.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { fixtureEpubs, SAMPLE_SOURCES } from '../../../tests/support/epub-fixtures';
import { type Highlight, highlightsOf, readingPath } from '../../core/epub';
import { boundsOf, rangeOver, walked } from './chapter-range';
import { makeEpubSide } from './epub-side';
import type { EpubSide } from './epub-side-types';
import { CHOOSE_WORDS, HIGHLIGHTED } from './page-highlights';
import { inked, withInk } from './test-ink';
import { laidOut } from './test-lines';
import { sideWith } from './test-side';

const EPUBS = fixtureEpubs(SAMPLE_SOURCES);
const CHAPTER = 'OEBPS/chapter-1.xhtml';
const FIRST_LINE = SAMPLE_SOURCES.chapters[0]?.[0] ?? '';

withInk();

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  document.getSelection()?.removeAllRanges();
  document.body.replaceChildren();
});

/** A book open on a page laid out, its reading file `before` (given its key) in the vault first. */
async function opened(before?: (key: string) => object) {
  const at = sideWith({ 'a.epub': EPUBS['plain.epub'] as Uint8Array });
  laidOut(at.side.page);
  if (before) {
    const peek = sideWith({ 'a.epub': EPUBS['plain.epub'] as Uint8Array });
    await peek.side.open('a.epub');
    const key = peek.side.epub?.key ?? '';
    peek.side.dispose();
    await at.disk.write(readingPath(key), JSON.stringify({ version: 1, ...before(key) }), null);
  }
  await at.side.open('a.epub');
  const key = at.side.epub?.key ?? '';
  const file = async () => (await at.disk.read(readingPath(key)))?.text ?? null;
  return { ...at, key, file };
}

/** `words` chosen in the chapter on the page, as a hand leaves them. */
function choose(side: EpubSide, words: string): void {
  const chapter = side.page.chapter;
  const text = chapter.textContent ?? '';
  const at = text.indexOf(words);
  expect(at, words).toBeGreaterThanOrEqual(0);
  // The chapter's text as a place counts it is its pieces': the fixture's first chapter has no blank ones but between blocks.
  const walk = walked(chapter);
  const offset = walk.pieces
    .map((piece) => piece.data)
    .join('')
    .indexOf(words);
  const bounds = boundsOf(walk, { from: offset, to: offset + words.length });
  const selection = document.getSelection();
  selection?.removeAllRanges();
  if (bounds) selection?.addRange(rangeOver(bounds));
}

const pressH = (side: EpubSide, init: KeyboardEventInit = {}) =>
  side.page.key(new KeyboardEvent('keydown', { key: 'h', cancelable: true, ...init }));
const said = (side: EpubSide) => side.page.foot.said.textContent;
const putBack = (side: EpubSide) =>
  side.page.foot.figures.find((figure) => figure.textContent === 'Put back') as
    | HTMLButtonElement
    | undefined;
const ticked = (side: EpubSide) =>
  [...side.page.chapter.querySelectorAll(`[${HIGHLIGHTED}]`)].map((block) =>
    block.textContent?.slice(0, 20),
  );

describe('H on a book’s page', () => {
  it('keeps the words chosen: in the reading file with its words, inked, its paragraph ticked', async () => {
    const { side, file } = await opened();
    choose(side, 'universally acknowledged');
    pressH(side);
    await vi.waitFor(() => expect(side.highlights).toHaveLength(1));
    const [kept] = highlightsOf(await file());
    expect(kept).toMatchObject({ chapter: CHAPTER, words: 'universally acknowledged' });
    expect((kept?.to ?? 0) - (kept?.from ?? 0)).toBe('universally acknowledged'.length);
    expect(inked('epub-highlight')).toEqual(['universally acknowledged']);
    expect(ticked(side)).toEqual([FIRST_LINE.slice(0, 20)]);
    expect(said(side)).toBe('Highlighted.');
    expect(document.getSelection()?.isCollapsed ?? true).toBe(true);
  });

  it('takes off the highlight the words lie in, choosing all its words, and Put back restores it', async () => {
    const { side, file } = await opened();
    choose(side, 'a single man in possession');
    pressH(side);
    await vi.waitFor(() => expect(side.highlights).toHaveLength(1));
    choose(side, 'single man');
    pressH(side);
    await vi.waitFor(() => expect(side.highlights).toHaveLength(0));
    expect(highlightsOf(await file())).toEqual([]);
    expect(inked('epub-highlight')).toEqual([]);
    expect(ticked(side)).toEqual([]);
    // Its whole words chosen, so H would keep them again as they were.
    expect(document.getSelection()?.toString()).toBe('a single man in possession');
    expect(said(side)).toBe('Highlight taken off.');
    const button = putBack(side);
    expect(button?.hidden).toBe(false);
    button?.click();
    await vi.waitFor(() => expect(side.highlights).toHaveLength(1));
    expect(side.highlights[0]?.words).toBe('a single man in possession');
    expect(said(side)).toBe('Highlight put back.');
    expect(putBack(side)).toBeUndefined();
  });

  it('joins the highlights the words overlap into one', async () => {
    const { side } = await opened();
    choose(side, 'It is a truth');
    pressH(side);
    await vi.waitFor(() => expect(side.highlights).toHaveLength(1));
    choose(side, 'acknowledged, that');
    pressH(side);
    await vi.waitFor(() => expect(side.highlights).toHaveLength(2));
    choose(side, 'truth universally acknowledged');
    pressH(side);
    await vi.waitFor(() => expect(side.highlights).toHaveLength(1));
    expect(side.highlights[0]?.words).toBe('It is a truth universally acknowledged, that');
  });

  it('says so with nothing chosen, and writes nothing', async () => {
    const { side, file } = await opened();
    const before = await file();
    pressH(side);
    await vi.waitFor(() => expect(said(side)).toBe(CHOOSE_WORDS));
    expect(await file()).toBe(before);
  });

  it('runs once while held, and never with ⌘, Ctrl or Alt', async () => {
    const { side, of } = await opened();
    const change = vi.spyOn(of.reading, 'change');
    choose(side, 'universally');
    pressH(side, { repeat: true });
    pressH(side, { metaKey: true });
    pressH(side, { altKey: true });
    await new Promise((done) => setTimeout(done, 20));
    expect(change).not.toHaveBeenCalled();
  });

  it('says the page in sight holds a highlight to the ear, and no longer once it’s off', async () => {
    const { side } = await opened();
    const heard = () => side.page.foot.figures.some((f) => f.textContent === 'highlighted');
    expect(heard()).toBe(false);
    choose(side, 'It is a truth');
    pressH(side);
    await vi.waitFor(() => expect(heard()).toBe(true));
    choose(side, 'It is');
    pressH(side);
    await vi.waitFor(() => expect(heard()).toBe(false));
  });

  it('offers Put back only while its news shows, the keyboard back on the page as it goes', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { side } = await opened();
    // The colophon the pane would lay the page's figures in.
    document.body.append(...side.page.foot.figures);
    choose(side, 'universally');
    pressH(side);
    await vi.waitFor(() => expect(side.highlights).toHaveLength(1));
    choose(side, 'universally');
    pressH(side);
    await vi.waitFor(() => expect(putBack(side)?.hidden).toBe(false));
    putBack(side)?.focus();
    expect(document.activeElement?.textContent).toBe('Put back');
    vi.advanceTimersByTime(10_000);
    expect(putBack(side)).toBeUndefined();
    expect(side.page.element.contains(document.activeElement)).toBe(true);
    expect(document.activeElement?.textContent).not.toBe('Put back');
  });
});

describe('a book’s highlights, read again', () => {
  const at = (from: number, to: number, chapter = CHAPTER): Highlight => ({
    chapter,
    from,
    to,
    words: '',
  });

  it('are inked when the book opens again, from its reading file', async () => {
    const { side } = await opened(() => ({ highlights: [at(10, 15)] }));
    await vi.waitFor(() => expect(inked('epub-highlight')).toHaveLength(1));
    expect(side.highlights).toEqual([at(10, 15)]);
    expect(ticked(side)).toHaveLength(1);
  });

  it('show none of another chapter’s, one gone from the book, or one past its words, and keep them', async () => {
    const gone = [
      at(0, 9, 'OEBPS/chapter-2.xhtml'),
      at(0, 9, 'OEBPS/no-such-chapter.xhtml'),
      at(900_000, 900_010),
    ];
    const { side, file } = await opened(() => ({ highlights: gone, theirs: [1] }));
    await vi.waitFor(() => expect(side.highlights).toHaveLength(3));
    expect(inked('epub-highlight')).toEqual([]);
    expect(ticked(side)).toEqual([]);
    // A new one beside them leaves them in the file, and everything else.
    choose(side, 'universally');
    pressH(side);
    await vi.waitFor(() => expect(side.highlights).toHaveLength(4));
    const kept = JSON.parse((await file()) ?? '{}');
    expect(kept.highlights.slice(0, 3)).toEqual(gone);
    expect(kept.theirs).toEqual([1]);
  });

  it('show on every page of the book at once, each page’s ink its own', async () => {
    const { side, of } = await opened();
    // A second page of the window's, over the same vault and store.
    const second = { side: makeEpubSide(of, { close: () => {}, caret: () => {} }, null) };
    document.body.append(second.side.page.element);
    await second.side.open('a.epub');
    choose(side, 'universally');
    pressH(side);
    await vi.waitFor(() => expect(second.side.highlights).toHaveLength(1));
    await vi.waitFor(() => expect(inked('epub-highlight')).toHaveLength(2));
    second.side.dispose();
    expect(inked('epub-highlight')).toEqual(['universally']);
  });
});
