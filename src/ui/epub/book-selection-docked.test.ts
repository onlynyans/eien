// The selection bar docked on a real book's page (#65), a touch screen's:
// over a vault in memory, the words chosen by a long press, then dropped by
// the system as the finger comes down on the bar, still reach Highlight,
// Quote and Copy through the page and the book's side; another chapter, or
// the page closed, takes the bar away.

import { afterEach, describe, expect, it, type Mock, vi } from 'vitest';
import { fixtureEpubs, SAMPLE_SOURCES } from '../../../tests/support/epub-fixtures';
import { HIGHLIGHT_LABELS } from './book-selection';
import type { EpubSide } from './epub-side-types';
import { withInk } from './test-ink';
import { laidOut } from './test-lines';
import { choose, sideWith } from './test-side';

const EPUBS = fixtureEpubs(SAMPLE_SOURCES);
const WORDS = 'universally acknowledged';

withInk();

afterEach(() => {
  vi.restoreAllMocks();
  document.getSelection()?.removeAllRanges();
  document.body.replaceChildren();
});

/** A book open on a page laid out, on a touch screen (the pointer coarse), its quote and copy watched. */
async function opened() {
  const at = sideWith({ 'a.epub': EPUBS['plain.epub'] as Uint8Array });
  const quote = vi.fn(
    async (_text: string, _from: unknown) => ({ into: 'At the Assembly' }) as const,
  );
  (at.of as { quote?: unknown }).quote = quote;
  laidOut(at.side.page);
  await at.side.open('a.epub');
  // Coarse once the book is open: the rest of the page asks the window other questions.
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query) =>
      ({
        matches: query.includes('coarse') || query.includes('none'),
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }) as unknown as MediaQueryList,
  );
  return { ...at, quote };
}

const bar = (side: EpubSide) =>
  side.page.under.querySelector<HTMLElement>('.selection-bar--docked');
const button = (side: EpubSide, name: string) =>
  [...(bar(side)?.querySelectorAll('button') ?? [])].find((b) => b.textContent === name);

/** `words` chosen by a long press: the system's choosing, no mouseup; the bar docked once it settles. */
async function chooseByTouch(side: EpubSide, words: string): Promise<void> {
  choose(side, words);
  document.dispatchEvent(new Event('selectionchange'));
  await vi.waitFor(() => expect(bar(side)?.hidden).toBe(false));
}

/** A finger down on the docked bar: the system drops the choice before its click. */
function pressDropping(side: EpubSide): void {
  bar(side)?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  document.getSelection()?.removeAllRanges();
  document.dispatchEvent(new Event('selectionchange'));
}

describe('the selection bar docked on a book’s page', () => {
  it('docks in the page’s foot, and its Highlight keeps the words last chosen', async () => {
    const { side } = await opened();
    await chooseByTouch(side, WORDS);
    pressDropping(side);
    button(side, HIGHLIGHT_LABELS.add)?.click();
    await vi.waitFor(() => expect(side.marks.highlights.all).toHaveLength(1));
    expect(side.marks.highlights.all[0]?.words).toBe(WORDS);
    expect(side.page.foot.said.textContent).toBe('Highlighted.');
  });

  it('reads Take off the highlight on words in one, and takes it off though the tap dropped them', async () => {
    const { side } = await opened();
    await chooseByTouch(side, WORDS);
    button(side, HIGHLIGHT_LABELS.add)?.click();
    await vi.waitFor(() => expect(side.marks.highlights.all).toHaveLength(1));
    await chooseByTouch(side, 'acknowledged');
    expect(bar(side)?.querySelector('button')?.textContent).toBe(HIGHLIGHT_LABELS.off);
    pressDropping(side);
    button(side, HIGHLIGHT_LABELS.off)?.click();
    await vi.waitFor(() => expect(side.marks.highlights.all).toHaveLength(0));
    expect(side.page.foot.said.textContent).toBe('Highlight taken off.');
  });

  it('quotes the words last chosen in the note beside', async () => {
    const { side, quote } = await opened();
    await chooseByTouch(side, WORDS);
    pressDropping(side);
    button(side, 'Quote in the note')?.click();
    await vi.waitFor(() => expect(quote).toHaveBeenCalledOnce());
    expect(quote.mock.calls[0]?.[0]).toMatch(/^> universally acknowledged\n/u);
  });

  it('copies the words last chosen through the window’s clipboard, plain and as HTML', async () => {
    const { side, of } = await opened();
    // Two paragraphs, so the HTML has shapes the plain words don't.
    const [first, second] = [...side.page.chapter.querySelectorAll('p')];
    const range = document.createRange();
    range.setStart(first?.firstChild as Node, 0);
    range.setEnd(second?.firstChild as Node, 'However'.length);
    document.getSelection()?.removeAllRanges();
    document.getSelection()?.addRange(range);
    document.dispatchEvent(new Event('selectionchange'));
    await vi.waitFor(() => expect(bar(side)?.hidden).toBe(false));
    pressDropping(side);
    button(side, 'Copy')?.click();
    expect(of.copy).toHaveBeenCalledOnce();
    const [text, html] = (of.copy as Mock).mock.calls[0] as [string, string];
    expect(text).toMatch(/^It is a truth universally acknowledged.+a wife\.\n\nHowever$/su);
    expect(html).toMatch(/^<p>It is a truth .+<\/p>\s*<p>However<\/p>$/su);
    // Its choice made, nothing is left chosen, and the bar goes with it.
    expect(document.getSelection()?.isCollapsed ?? true).toBe(true);
    expect(bar(side)?.hidden).toBe(true);
  });

  it('goes with its chapter: another drawn leaves no bar and nothing kept to act on', async () => {
    const { side, of } = await opened();
    await chooseByTouch(side, WORDS);
    await side.go(2);
    expect(bar(side)?.hidden).toBe(true);
    expect(side.page.sheet.kept).toBeNull();
    button(side, 'Copy')?.click();
    expect(of.copy).not.toHaveBeenCalled();
  });

  it('goes with its page, and a mouseup on its scroller after never puts it back', async () => {
    const { side } = await opened();
    choose(side, WORDS);
    side.dispose();
    side.page.element
      .querySelector('.page__scroll')
      ?.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    await new Promise((settled) => setTimeout(settled, 300));
    expect(document.querySelector('.selection-bar')).toBeNull();
    expect(side.page.under.querySelector('.selection-bar')).toBeNull();
  });
});
