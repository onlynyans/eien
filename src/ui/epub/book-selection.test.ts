// The selection bar over a book (#40, Phase 2c): it shows a moment after a
// choice in the chapter, never on a touch screen, and goes on Esc, a scroll,
// the keyboard leaving, a resize, or the choice gone; taken off, it leaves
// nothing listening.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BookSelection } from './book-selection';

let chapter: HTMLElement;
let scroller: HTMLElement;
const quote = vi.fn();

beforeEach(() => {
  vi.useFakeTimers();
  scroller = document.createElement('div');
  chapter = document.createElement('div');
  chapter.innerHTML = '<p>It is a truth universally acknowledged.</p><p>However little known.</p>';
  scroller.append(chapter);
  document.body.append(scroller);
  quote.mockClear();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.getSelection()?.removeAllRanges();
  document.body.replaceChildren();
});

/** The chapter's first paragraph chosen, as a hand leaves it. */
function choose(): void {
  const range = document.createRange();
  range.selectNodeContents(chapter.querySelector('p') as Node);
  document.getSelection()?.removeAllRanges();
  document.getSelection()?.addRange(range);
  document.dispatchEvent(new Event('selectionchange'));
  scroller.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
}

const bar = () => document.querySelector<HTMLElement>('.selection-bar');
const highlight = vi.fn();
/** Whether the words chosen lie in a highlight, as the page says. */
let held = false;

describe('the selection bar over a book', () => {
  it('shows a moment after a choice, its Quote quoting and Copy copying', () => {
    new BookSelection({ chapter, scroller, quote, highlight, inHighlight: () => held });
    choose();
    expect(bar()?.hidden).toBe(true);
    vi.advanceTimersByTime(250);
    expect(bar()?.hidden).toBe(false);
    expect(bar()?.getAttribute('role')).toBe('toolbar');
    const [, quoteButton, copy] = [...(bar()?.querySelectorAll('button') ?? [])];
    expect(copy?.getAttribute('aria-keyshortcuts')).toBe('Meta+C Control+C');
    quoteButton?.click();
    expect(quote).toHaveBeenCalledOnce();
    expect(bar()?.hidden).toBe(true);
  });

  it('goes on Esc, a scroll, the keyboard leaving the page, a resize, or the choice gone', () => {
    new BookSelection({ chapter, scroller, quote, highlight, inHighlight: () => held });
    const away: (() => void)[] = [
      () => scroller.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })),
      () => scroller.dispatchEvent(new Event('scroll')),
      () => scroller.dispatchEvent(new FocusEvent('focusout')),
      () => window.dispatchEvent(new Event('resize')),
      () => {
        document.getSelection()?.removeAllRanges();
        document.dispatchEvent(new Event('selectionchange'));
      },
    ];
    for (const go of away) {
      choose();
      vi.advanceTimersByTime(250);
      expect(bar()?.hidden).toBe(false);
      go();
      expect(bar()?.hidden).toBe(true);
    }
  });

  it('never shows on a touch screen, where the system’s own callout is', () => {
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query) =>
        ({ matches: query.includes('coarse') || query.includes('none') }) as MediaQueryList,
    );
    new BookSelection({ chapter, scroller, quote, highlight, inHighlight: () => held });
    choose();
    vi.advanceTimersByTime(250);
    expect(bar()?.hidden).toBe(true);
  });

  it('keeps the words last chosen for a phone’s ⋯, until another chapter or a press in this one', () => {
    const selection = new BookSelection({
      chapter,
      scroller,
      quote,
      highlight,
      inHighlight: () => held,
    });
    choose();
    document.getSelection()?.removeAllRanges();
    expect(selection.range).toBeNull();
    expect(selection.kept?.toString()).toBe('It is a truth universally acknowledged.');
    chapter.dispatchEvent(new MouseEvent('mousedown'));
    expect(selection.kept).toBeNull();
    choose();
    selection.forget();
    document.getSelection()?.removeAllRanges();
    expect(selection.kept).toBeNull();
  });

  it('taken off, listens for nothing and leaves no bar', () => {
    const removed = vi.spyOn(document, 'removeEventListener');
    const selection = new BookSelection({
      chapter,
      scroller,
      quote,
      highlight,
      inHighlight: () => held,
    });
    selection.remove();
    expect(removed).toHaveBeenCalledWith('selectionchange', expect.any(Function));
    expect(bar()).toBeNull();
    choose();
    vi.advanceTimersByTime(250);
    expect(bar()).toBeNull();
  });

  it('offers Highlight first, by H and Format → Highlight’s keys, and Take off the highlight on words in one', () => {
    held = false;
    new BookSelection({ chapter, scroller, quote, highlight, inHighlight: () => held });
    choose();
    vi.advanceTimersByTime(250);
    const first = bar()?.querySelector('button');
    expect(first?.textContent).toBe('Highlight');
    expect(first?.getAttribute('aria-keyshortcuts')).toBe('H Control+Shift+H');
    first?.click();
    expect(highlight).toHaveBeenCalledOnce();
    held = true;
    choose();
    vi.advanceTimersByTime(250);
    expect(bar()?.querySelector('button')?.textContent).toBe('Take off the highlight');
  });
});
