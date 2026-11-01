// A book's highlights on its page (#40, Phase 5a), over a real page and a
// vault in memory: H keeps the words chosen and takes off the highlight they
// lie in, Put back restores it, each inked and ticked on the page and kept in
// the reading file beside what's there; read again when the book opens; and
// what can't be shown (another chapter's, one gone, past the words) never
// painted, never thrown over.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { fixtureEpubs, SAMPLE_SOURCES } from '../../../tests/support/epub-fixtures';
import { type Highlight, highlightsOf, MAX_HIGHLIGHTS, readingPath } from '../../core/epub';
import { NOT_KEPT } from './book-marks';
import { walked } from './chapter-range';
import { makeEpubSide } from './epub-side';
import type { EpubSide } from './epub-side-types';
import { CHOOSE_WORDS, HIGHLIGHTED } from './page-highlights';
import { inkCount, inked, withInk } from './test-ink';
import { laidOut } from './test-lines';
import { choose, sideWith } from './test-side';

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
    await vi.waitFor(() => expect(side.marks.highlights.all).toHaveLength(1));
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
    await vi.waitFor(() => expect(side.marks.highlights.all).toHaveLength(1));
    choose(side, 'single man');
    pressH(side);
    await vi.waitFor(() => expect(side.marks.highlights.all).toHaveLength(0));
    expect(highlightsOf(await file())).toEqual([]);
    expect(inked('epub-highlight')).toEqual([]);
    expect(ticked(side)).toEqual([]);
    // Its whole words chosen, so H would keep them again as they were.
    expect(document.getSelection()?.toString()).toBe('a single man in possession');
    expect(said(side)).toBe('Highlight taken off.');
    const button = putBack(side);
    expect(button?.hidden).toBe(false);
    button?.click();
    await vi.waitFor(() => expect(side.marks.highlights.all).toHaveLength(1));
    expect(side.marks.highlights.all[0]?.words).toBe('a single man in possession');
    expect(said(side)).toBe('Highlight put back.');
    expect(putBack(side)).toBeUndefined();
  });

  it('joins the highlights the words overlap into one', async () => {
    const { side } = await opened();
    choose(side, 'It is a truth');
    pressH(side);
    await vi.waitFor(() => expect(side.marks.highlights.all).toHaveLength(1));
    choose(side, 'acknowledged, that');
    pressH(side);
    await vi.waitFor(() => expect(side.marks.highlights.all).toHaveLength(2));
    choose(side, 'truth universally acknowledged');
    pressH(side);
    await vi.waitFor(() => expect(side.marks.highlights.all).toHaveLength(1));
    expect(side.marks.highlights.all[0]?.words).toBe(
      'It is a truth universally acknowledged, that',
    );
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
    await vi.waitFor(() => expect(side.marks.highlights.all).toHaveLength(1));
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
    expect(side.marks.highlights.all).toEqual([at(10, 15)]);
    expect(ticked(side)).toHaveLength(1);
  });

  it('show none of another chapter’s, one gone from the book, or one past its words, and keep them', async () => {
    const gone = [
      at(0, 9, 'OEBPS/chapter-2.xhtml'),
      at(0, 9, 'OEBPS/no-such-chapter.xhtml'),
      at(900_000, 900_010),
    ];
    const { side, file } = await opened(() => ({ highlights: gone, theirs: [1] }));
    await vi.waitFor(() => expect(side.marks.highlights.all).toHaveLength(3));
    expect(inked('epub-highlight')).toEqual([]);
    expect(ticked(side)).toEqual([]);
    // A new one beside them leaves them in the file, and everything else.
    choose(side, 'universally');
    pressH(side);
    await vi.waitFor(() => expect(side.marks.highlights.all).toHaveLength(4));
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
    await vi.waitFor(() => expect(second.side.marks.highlights.all).toHaveLength(1));
    await vi.waitFor(() => expect(inked('epub-highlight')).toHaveLength(2));
    second.side.dispose();
    expect(inked('epub-highlight')).toEqual(['universally']);
  });
});

// QA (#40, Phase 5a): what the review's plan asked of H beyond the first tests, each tried on a
// real page over a vault in memory.

/** The offset of `words` in the first chapter, as a place counts it: from a page of its own, let go. */
async function offsetOf(words: string): Promise<number> {
  const peek = sideWith({ 'a.epub': EPUBS['plain.epub'] as Uint8Array });
  await peek.side.open('a.epub');
  const at = walked(peek.side.page.chapter)
    .pieces.map((piece) => piece.data)
    .join('')
    .indexOf(words);
  peek.side.dispose();
  document.body.replaceChildren();
  expect(at, words).toBeGreaterThanOrEqual(0);
  return at;
}

/** `text` written over the file at `path`, at the version it's at. */
async function overwrite(
  disk: ReturnType<typeof sideWith>['disk'],
  path: string,
  text: string,
): Promise<void> {
  const now = await disk.read(path);
  expect((await disk.write(path, text, now?.version ?? null)).ok).toBe(true);
}

const mark = (from: number, to: number, chapter = CHAPTER): Highlight => ({
  chapter,
  from,
  to,
  words: '',
});

describe('a book with a thousand highlights', () => {
  /** A full book: the last of them on “universally”, the rest in the second chapter. */
  async function full() {
    const from = await offsetOf('universally');
    const elsewhere = Array.from({ length: MAX_HIGHLIGHTS - 1 }, (_, i) =>
      mark(i * 2, i * 2 + 1, 'OEBPS/chapter-2.xhtml'),
    );
    const book = await opened(() => ({
      highlights: [...elsewhere, mark(from, from + 'universally'.length)],
    }));
    expect(book.side.marks.highlights.all).toHaveLength(MAX_HIGHLIGHTS);
    return book;
  }

  it('refuses a new one, saying why, and leaves the file as it was', async () => {
    const { side, file } = await full();
    const before = await file();
    choose(side, 'It is a truth');
    pressH(side);
    await vi.waitFor(() =>
      expect(said(side)).toBe('A book keeps 1,000 highlights at most: take one off first.'),
    );
    expect(await file()).toBe(before);
    expect(side.marks.highlights.all).toHaveLength(MAX_HIGHLIGHTS);
  });

  it('joins words to the one they touch, as that makes none more', async () => {
    const { side, file } = await full();
    choose(side, 'universally acknowledged');
    pressH(side);
    await vi.waitFor(() => expect(said(side)).toBe('Highlighted.'));
    const kept = highlightsOf(await file());
    expect(kept).toHaveLength(MAX_HIGHLIGHTS);
    expect(kept.at(-1)?.words).toBe('universally acknowledged');
  });

  it('takes one off, as that makes room', async () => {
    const { side, file } = await full();
    choose(side, 'universally');
    pressH(side);
    await vi.waitFor(() => expect(said(side)).toBe('Highlight taken off.'));
    expect(highlightsOf(await file())).toHaveLength(MAX_HIGHLIGHTS - 1);
  });
});

describe('a highlight in a reading file this Eien won’t write', () => {
  /** H pressed on `words`, and the news it gave once it gave some. */
  async function pressed(side: EpubSide, words: string): Promise<void> {
    side.page.foot.say('');
    choose(side, words);
    pressH(side);
    await vi.waitFor(() => expect(said(side)).not.toBe(''));
  }

  // QA (#40, Phase 5a) found a new highlight written by two changes in a row,
  // `withHighlights(withHighlights(text, { remove }), { add })`: over a newer Eien's file or one
  // that can't be read, the first gave null (not to be written) and the second read that null as
  // no file at all, writing a new one over it and saying "Highlighted.". Now decided and made in
  // one change (core's pressHighlight).
  it('isn’t kept in a newer Eien’s file: the file is as it was, and the colophon says why', async () => {
    const newer = JSON.stringify({ version: 2, highlights: [], theirs: 'kept' });
    const { side, disk, key, file } = await opened();
    // Another device's newer Eien wrote it since the book opened, and it synced.
    await overwrite(disk, readingPath(key), newer);
    await pressed(side, 'universally');
    expect(await file()).toBe(newer);
    expect(said(side)).toBe(NOT_KEPT.newer);
    expect(side.marks.highlights.all).toEqual([]);
    expect(inked('epub-highlight')).toEqual([]);
  });

  it('isn’t kept in a file that can’t be read: said when the book opens and again on H, never written over', async () => {
    const broken = '{ "highlights": [ broken';
    const { side, disk, key, file } = await opened();
    await overwrite(disk, readingPath(key), broken);
    await side.reload();
    expect(said(side)).toBe(NOT_KEPT.unreadable);
    await pressed(side, 'universally');
    expect(await file()).toBe(broken);
    expect(said(side)).toBe(NOT_KEPT.unreadable);
    expect(side.marks.highlights.all).toEqual([]);
  });

  it('isn’t taken off in a newer Eien’s file: the file is as it was, the highlight still there', async () => {
    const from = await offsetOf('universally');
    const one = mark(from, from + 'universally'.length);
    const { side, file } = await opened(() => ({ version: 2, highlights: [one], theirs: 'kept' }));
    const before = await file();
    expect(side.marks.highlights.all).toEqual([one]);
    await pressed(side, 'universally');
    expect(await file()).toBe(before);
    expect(said(side)).toBe(NOT_KEPT.newer);
    expect(side.marks.highlights.all).toEqual([one]);
    expect(putBack(side)).toBeUndefined();
  });
});

describe('H pressed twice at once', () => {
  it('runs the second after the first is kept: the words then chosen no more, it says so', async () => {
    const { side, file } = await opened();
    choose(side, 'universally acknowledged');
    pressH(side);
    pressH(side);
    await vi.waitFor(() => expect(said(side)).toBe(CHOOSE_WORDS));
    // Never the second deciding on the same words beside the first, and taking its highlight off.
    expect(highlightsOf(await file()).map((each) => each.words)).toEqual([
      'universally acknowledged',
    ]);
  });
});

describe('the phone’s ⋯ Highlight', () => {
  /** The words chosen as a hand leaves them, and then dropped, as the ⋯'s tap may. */
  function chosenThenDropped(side: EpubSide, words: string): void {
    choose(side, words);
    document.dispatchEvent(new Event('selectionchange'));
    document.getSelection()?.removeAllRanges();
    document.dispatchEvent(new Event('selectionchange'));
  }

  it('keeps the words last chosen, though the tap dropped them; plain H finds none', async () => {
    const { side } = await opened();
    chosenThenDropped(side, 'universally acknowledged');
    await side.marks.highlights.toggle();
    expect(said(side)).toBe(CHOOSE_WORDS);
    expect(side.marks.highlights.all).toEqual([]);
    await side.marks.highlights.toggle(true);
    expect(side.marks.highlights.all.map((each) => each.words)).toEqual([
      'universally acknowledged',
    ]);
  });

  it('knows the words last chosen lie in a highlight, so its choice reads as taking it off', async () => {
    const { side } = await opened();
    choose(side, 'a single man in possession');
    await side.marks.highlights.toggle();
    chosenThenDropped(side, 'single man');
    expect(side.marks.highlights.holdsChosen(true)).toBe(true);
    expect(side.marks.highlights.holdsChosen(false)).toBe(false);
    await side.marks.highlights.toggle(true);
    expect(side.marks.highlights.all).toEqual([]);
  });
});

describe('a highlight across chapters', () => {
  it('is inked again when its chapter is drawn again, its old ranges let go', async () => {
    const { side } = await opened();
    choose(side, 'universally');
    pressH(side);
    await vi.waitFor(() => expect(inkCount('epub-highlight')).toBe(1));
    for (let i = 0; i < 3; i++) {
      // The book's second chapter in the reading order (its title page first), and back.
      await side.go(2);
      expect(inkCount('epub-highlight')).toBe(0);
      await side.go(1);
      expect(inked('epub-highlight')).toEqual(['universally']);
    }
    // Inked over the chapter drawn now, never one let go.
    const registry = (globalThis.CSS as unknown as { highlights: Map<string, Set<AbstractRange>> })
      .highlights;
    const [range] = [...(registry.get('epub-highlight') ?? [])];
    expect(side.page.chapter.contains(range?.startContainer ?? null)).toBe(true);
  });

  it('taken off from another chapter (a Marks row), offers Put back and leaves the words chosen here be', async () => {
    const elsewhere = mark(0, 9, 'OEBPS/chapter-2.xhtml');
    const { side, file } = await opened(() => ({ highlights: [elsewhere] }));
    choose(side, 'universally');
    await side.marks.highlights.remove(side.marks.highlights.all[0] as Highlight);
    expect(highlightsOf(await file())).toEqual([]);
    expect(said(side)).toBe('Highlight taken off.');
    expect(putBack(side)?.hidden).toBe(false);
    expect(document.getSelection()?.toString()).toBe('universally');
    putBack(side)?.click();
    await vi.waitFor(async () => expect(highlightsOf(await file())).toEqual([elsewhere]));
  });
});
