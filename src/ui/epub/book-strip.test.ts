// A book on its page's edge (#40, Phase 4d): its chapters and bookmarks on
// the strip, the place told as it moves, and a point on it opening the
// chapter there.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { fixtureEpubs, SAMPLE_SOURCES } from '../../../tests/support/epub-fixtures';
import { oneChapter } from '../../../tests/support/epub-parts';
import { DEFAULT_SETTINGS } from '../../core/config';
import { type Epub, type Highlight, percent, readingPath } from '../../core/epub';
import { laidOut } from './test-lines';
import { sideWith } from './test-side';

const EPUBS = fixtureEpubs(SAMPLE_SOURCES);

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

async function opened() {
  const at = sideWith({ 'a.epub': EPUBS['plain.epub'] as Uint8Array });
  laidOut(at.side.page);
  await at.side.open('a.epub');
  const strip = at.side.page.element.querySelector<HTMLElement>('.edge-strip') as HTMLElement;
  strip.getBoundingClientRect = () => ({ top: 0, height: 1000 }) as DOMRect;
  return { ...at, strip };
}

describe('a book on its page’s edge', () => {
  it('shows each of its chapters, and each bookmark once made', async () => {
    const { side, strip } = await opened();
    expect(strip.querySelectorAll('.edge-strip__chapter')).toHaveLength(
      new Set(side.epub?.contents.filter((row) => row.depth === 0).map((row) => row.spine)).size,
    );
    expect(strip.querySelectorAll('.edge-strip__mark')).toHaveLength(0);
    side.page.key(new KeyboardEvent('keydown', { key: 'b' }));
    await vi.waitFor(() => expect(strip.querySelectorAll('.edge-strip__mark')).toHaveLength(1));
  });

  // QA (#40, Phase 5b): the strip follows the book's highlights as its file changes.
  it('ticks each highlight kept, and lets one go once it’s taken off', async () => {
    const { side, strip, disk, of } = await opened();
    const key = side.epub?.key ?? '';
    const highlight = { chapter: 'OEBPS/chapter-2.xhtml', from: 10, to: 20, words: 'kept' };
    await disk.write(
      readingPath(key),
      JSON.stringify({ version: 1, highlights: [highlight] }),
      null,
    );
    await side.reload();
    await vi.waitFor(() =>
      expect(strip.querySelectorAll('.edge-strip__highlight')).toHaveLength(1),
    );
    expect(strip.querySelectorAll('.edge-strip__mark')).toHaveLength(0);
    // The book counted whole first: no count's redraw stands in for the change's own.
    const epub = side.epub as Epub;
    await vi.waitFor(() => expect(of.counts.of(epub).whole).toBe(true));
    await side.marks.highlights.remove(side.marks.highlights.all[0] as Highlight);
    expect(strip.querySelectorAll('.edge-strip__highlight')).toHaveLength(0);
  });

  it('says where the page is, by its chapter', async () => {
    const { strip } = await opened();
    expect(strip.getAttribute('aria-valuetext')).toMatch(/^Chapter I/u);
  });

  it('opens the chapter a point on it is in, and steps a chapter at a time by its keys', async () => {
    const { side, strip } = await opened();
    const at = (y: number, type: string) =>
      strip.dispatchEvent(new PointerEvent(type, { clientY: y, button: 0, bubbles: true }));
    at(999, 'pointerdown');
    at(999, 'pointerup');
    const last = side.epub?.spine.length ?? 0;
    await vi.waitFor(() => expect(side.spine).toBe(last - 1));
    // The keyboard back on the page: Page Down turns it, never the strip's ten chapters.
    expect(document.activeElement).not.toBe(strip);
    strip.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    await vi.waitFor(() => expect(side.spine).toBe(side.epub?.contents[0]?.spine));
    strip.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await vi.waitFor(() => expect(side.spine).toBe((side.epub?.contents[0]?.spine ?? 0) + 1));
  });

  it('is hidden with no book on the page', async () => {
    const { side, strip } = await opened();
    expect(strip.hidden).toBe(false);
    side.clear();
    expect(strip.hidden).toBe(true);
  });
});

// QA (Phase 4d): the strip on a real book's page, as the spec says it
// behaves: the chapter drawn never drawn again, the strip kept apart from
// the sheet a hand turns, the setting worn as it's switched, and the page
// said as the count comes in.
describe('a book on its page’s edge, as the page holds it (QA)', () => {
  const click = (strip: HTMLElement, y: number) => {
    for (const type of ['pointerdown', 'pointerup'])
      strip.dispatchEvent(new PointerEvent(type, { clientY: y, button: 0, bubbles: true }));
  };

  it('shows a place chosen in the chapter drawn without drawing it again, and keeps it', async () => {
    const { side, strip, writes } = await opened();
    const here = side.spine;
    const chapter = vi.spyOn(side.epub as Epub, 'chapter');
    // plain.epub's Chapter I runs from about 17% to 49% of the book.
    click(strip, 300);
    await vi.waitFor(() => expect(writes).toHaveBeenCalled());
    expect(chapter).not.toHaveBeenCalled();
    expect(side.spine).toBe(here);
    const [, kept] = writes.mock.lastCall ?? [];
    expect(kept.chapter).toBe(side.epub?.spine[here]?.path);
    expect(kept.offset).toBeGreaterThan(0);
  });

  it('stands on the book’s leaf, apart from the sheet a hand turns, in Scroll and in Pages', async () => {
    const { side, strip } = await opened();
    const scroller = side.page.element.querySelector('.page__scroll');
    for (const view of ['scroll', 'pages'] as const) {
      side.follow({ ...DEFAULT_SETTINGS, 'epub.view': view, 'epub.marks': 'edge' });
      expect(side.page.element.dataset.view).toBe(view);
      expect(strip.parentElement).toBe(side.page.element);
      expect(scroller?.contains(strip)).toBe(false);
    }
  });

  it('wears the Marks setting on the leaf as it’s switched, the strip as it was drawn', async () => {
    const { side, strip } = await opened();
    side.page.key(new KeyboardEvent('keydown', { key: 'b' }));
    await vi.waitFor(() => expect(strip.querySelectorAll('.edge-strip__mark')).toHaveLength(1));
    const pieces = strip.querySelectorAll('i').length;
    for (const marks of ['edge', 'list', 'edge'] as const) {
      side.follow({ ...DEFAULT_SETTINGS, 'epub.marks': marks });
      expect(side.page.element.dataset.marks).toBe(marks);
      expect(side.page.element.querySelector('.edge-strip')).toBe(strip);
      expect(strip.querySelectorAll('i')).toHaveLength(pieces);
    }
  });

  it('draws another book’s chapters when another book comes to the page', async () => {
    const at = sideWith({
      'a.epub': EPUBS['plain.epub'] as Uint8Array,
      'b.epub': oneChapter(`<p>${'One chapter alone. '.repeat(20)}</p>`),
    });
    laidOut(at.side.page);
    await at.side.open('a.epub');
    const strip = at.side.page.element.querySelector('.edge-strip') as HTMLElement;
    expect(strip.querySelectorAll('.edge-strip__chapter')).toHaveLength(3);
    // As it's drawn, never waiting for its count: a book counted already tells no more.
    await at.side.open('b.epub');
    expect(strip.querySelectorAll('.edge-strip__chapter')).toHaveLength(1);
    expect(strip.getAttribute('aria-valuetext')).toMatch(/^Chapter I/u);
    await at.side.open('a.epub');
    expect(strip.querySelectorAll('.edge-strip__chapter')).toHaveLength(3);
  });

  it('says a printed book’s page at once, and how far through the book otherwise (#67)', async () => {
    const printed = sideWith({ 'a.epub': EPUBS['page-list.epub'] as Uint8Array });
    laidOut(printed.side.page);
    await printed.side.open('a.epub');
    const strip = (at: ReturnType<typeof sideWith>) =>
      at.side.page.element.querySelector('.edge-strip') as HTMLElement;
    expect(strip(printed).getAttribute('aria-valuetext')).toBe('Chapter I, page xii of 5');
    // No page-list: how far through the book, as the colophon says it, without a scroll.
    const { side } = await opened();
    const share = side.page.element.querySelector('.edge-strip') as HTMLElement;
    await vi.waitFor(() =>
      expect(share.getAttribute('aria-valuetext')).toMatch(/^Chapter I, \d+% of the book$/u),
    );
    expect(share.getAttribute('aria-valuetext')).toContain(
      side.page.foot.figures.find((each) => each.classList.contains('colophon__through'))
        ?.textContent ?? 'none',
    );
  });

  it('ticks a mark where its row says it is, within its chapter once that’s counted (#67)', async () => {
    const { side, strip, disk, of } = await opened();
    const epub = side.epub as Epub;
    await vi.waitFor(() => expect(of.counts.of(epub).whole).toBe(true));
    // Halfway into Chapter III by its counted words: a share of the book well past the chapter's start.
    const spine = epub.spine.findIndex((item) => item.path === 'OEBPS/chapter-3.xhtml');
    const offset = Math.floor((of.counts.of(epub).lengths[spine] ?? 0) / 2);
    await disk.write(
      readingPath(epub.key),
      JSON.stringify({
        version: 1,
        bookmarks: [{ chapter: 'OEBPS/chapter-3.xhtml', offset, words: 'halfway' }],
      }),
      null,
    );
    await side.reload();
    const mark = () => strip.querySelector<HTMLElement>('.edge-strip__mark');
    await vi.waitFor(() => expect(mark()).not.toBeNull());
    const share = Number(mark()?.style.getPropertyValue('--at'));
    expect(percent(share)).toBe(side.labelAt(spine, offset));
    expect(share).toBeGreaterThan(
      Number(
        strip
          .querySelectorAll<HTMLElement>('.edge-strip__chapter')[2]
          ?.style.getPropertyValue('--at'),
      ),
    );
  });
});
