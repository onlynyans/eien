// The selection bar over a book (#40, Phase 2c): it shows a moment after a
// choice in the chapter, and goes on Esc, a scroll, the keyboard leaving, a
// resize, or the choice gone; on a touch screen it docks at the page's foot
// (#65); taken off, it leaves nothing listening.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BookSelection } from './book-selection';

let chapter: HTMLElement;
let scroller: HTMLElement;
let dock: HTMLElement;
const quote = vi.fn();
const copy = vi.fn();

beforeEach(() => {
  vi.useFakeTimers();
  scroller = document.createElement('div');
  chapter = document.createElement('div');
  chapter.innerHTML = '<p>It is a truth universally acknowledged.</p><p>However little known.</p>';
  scroller.append(chapter);
  dock = document.createElement('div');
  document.body.append(scroller, dock);
  quote.mockClear();
  copy.mockClear();
  highlight.mockClear();
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

/** A touch screen: the pointer coarse. */
const touchScreen = () =>
  vi
    .spyOn(window, 'matchMedia')
    .mockImplementation(
      (query) =>
        ({ matches: query.includes('coarse') || query.includes('none') }) as MediaQueryList,
    );

/** The chapter's first paragraph chosen by a long press: the system's choosing, no mouseup. */
function chooseByTouch(): void {
  const range = document.createRange();
  range.selectNodeContents(chapter.querySelector('p') as Node);
  document.getSelection()?.removeAllRanges();
  document.getSelection()?.addRange(range);
  document.dispatchEvent(new Event('selectionchange'));
}

/** The words the bar's Copy gave, as plain text. */
const copyWords = () => copy.mock.lastCall?.[0]?.toString();
const highlight = vi.fn();
/** Whether the words chosen lie in a highlight, as the page says. */
let held = false;
/** The bar over the chapter, as its page makes it. */
const made = () =>
  new BookSelection({ chapter, scroller, dock, quote, highlight, copy, inHighlight: () => held });

describe('the selection bar over a book', () => {
  it('shows a moment after a choice, its Quote quoting and Copy copying', () => {
    made();
    choose();
    expect(bar()?.hidden).toBe(true);
    vi.advanceTimersByTime(250);
    expect(bar()?.hidden).toBe(false);
    expect(bar()?.getAttribute('role')).toBe('toolbar');
    const [, quoteButton, copy] = [...(bar()?.querySelectorAll('button') ?? [])];
    expect(copy?.getAttribute('aria-keyshortcuts')).toBe('Meta+C Control+C');
    quoteButton?.click();
    expect(quote).toHaveBeenCalledWith(false);
    expect(bar()?.hidden).toBe(true);
    choose();
    vi.advanceTimersByTime(250);
    copy?.click();
    expect(copyWords()).toBe('It is a truth universally acknowledged.');
  });

  it('goes on Esc, a scroll, the keyboard leaving the page, a resize, or the choice gone', () => {
    made();
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

  it('on a touch screen, docks at the page’s foot as words are chosen, there till the choice goes (#65)', () => {
    touchScreen();
    made();
    chooseByTouch();
    expect(bar()?.hidden).toBe(true);
    vi.advanceTimersByTime(250);
    expect(bar()?.hidden).toBe(false);
    expect(bar()?.parentElement).toBe(dock);
    expect(bar()?.classList.contains('selection-bar--docked')).toBe(true);
    expect([...(bar()?.querySelectorAll('button') ?? [])].map((b) => b.textContent)).toEqual([
      'Highlight',
      'Quote in the note',
      'Copy',
    ]);
    // The words scroll with their choice, the keyboard elsewhere: the docked bar stays.
    scroller.dispatchEvent(new Event('scroll'));
    scroller.dispatchEvent(new FocusEvent('focusout'));
    window.dispatchEvent(new Event('resize'));
    expect(bar()?.hidden).toBe(false);
    document.getSelection()?.removeAllRanges();
    document.dispatchEvent(new Event('selectionchange'));
    expect(bar()?.hidden).toBe(true);
  });

  it('docked, acts on the words last chosen though the tap dropped them, then lets the choice go', () => {
    touchScreen();
    made();
    const buttons = () => [...(bar()?.querySelectorAll('button') ?? [])];
    for (const [at, run] of [
      [0, highlight],
      [1, quote],
    ] as const) {
      chooseByTouch();
      vi.advanceTimersByTime(250);
      // The finger comes down on the bar; the system drops the choice before its click.
      bar()?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      document.getSelection()?.removeAllRanges();
      document.dispatchEvent(new Event('selectionchange'));
      expect(bar()?.hidden).toBe(false);
      buttons()[at]?.click();
      expect(run).toHaveBeenCalledWith(true);
      expect(bar()?.hidden).toBe(true);
    }
    chooseByTouch();
    vi.advanceTimersByTime(250);
    bar()?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    document.getSelection()?.removeAllRanges();
    document.dispatchEvent(new Event('selectionchange'));
    buttons()[2]?.click();
    expect(copyWords()).toBe('It is a truth universally acknowledged.');
    // Its choice made, nothing is left chosen: the system's menu goes with the bar.
    chooseByTouch();
    vi.advanceTimersByTime(250);
    buttons()[2]?.click();
    expect(document.getSelection()?.isCollapsed).toBe(true);
  });

  it('docked, a finger lifted off the bar with no click lets a dropped choice take it away', () => {
    touchScreen();
    made();
    chooseByTouch();
    vi.advanceTimersByTime(250);
    bar()?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    document.getSelection()?.removeAllRanges();
    document.dispatchEvent(new Event('selectionchange'));
    bar()?.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    expect(bar()?.hidden).toBe(false);
    vi.advanceTimersByTime(250);
    expect(bar()?.hidden).toBe(true);
  });

  it('floats again over the words where the pointer is fine', () => {
    touchScreen();
    made();
    chooseByTouch();
    vi.advanceTimersByTime(250);
    vi.restoreAllMocks();
    choose();
    vi.advanceTimersByTime(250);
    expect(bar()?.parentElement).toBe(document.body);
    expect(bar()?.classList.contains('selection-bar--docked')).toBe(false);
  });

  it('docked, words chosen outside the chapter (a note beside) never show it, and take it away', () => {
    touchScreen();
    made();
    const note = document.createElement('p');
    note.textContent = 'A note beside the book.';
    document.body.append(note);
    const chooseInNote = () => {
      document.getSelection()?.selectAllChildren(note);
      document.dispatchEvent(new Event('selectionchange'));
      vi.advanceTimersByTime(250);
    };
    chooseInNote();
    expect(bar()?.hidden).toBe(true);
    chooseByTouch();
    vi.advanceTimersByTime(250);
    expect(bar()?.hidden).toBe(false);
    chooseInNote();
    expect(bar()?.hidden).toBe(true);
  });

  // QA (#65): a press on the floating bar a mouse lets go off it has no click, nor a pointerup there.
  it('floating, a press let go off the bar never keeps it over words no longer chosen', () => {
    made();
    choose();
    vi.advanceTimersByTime(250);
    const [first] = [...(bar()?.querySelectorAll('button') ?? [])];
    first?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'mouse' }));
    window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: 'mouse' }));
    vi.advanceTimersByTime(250);
    // The words go some way the bar doesn't hear of: H kept them, or a press in a note beside.
    document.getSelection()?.removeAllRanges();
    document.dispatchEvent(new Event('selectionchange'));
    expect(bar()?.hidden).toBe(true);
  });

  it('keeps the words last chosen for a phone’s ⋯, until another chapter or a press in this one', () => {
    const selection = made();
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
    const selection = made();
    selection.remove();
    expect(removed).toHaveBeenCalledWith('selectionchange', expect.any(Function));
    expect(bar()).toBeNull();
    choose();
    vi.advanceTimersByTime(250);
    expect(bar()).toBeNull();
  });

  it('offers Highlight first, by H and Format → Highlight’s keys, and Take off the highlight on words in one', () => {
    held = false;
    made();
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

// QA (#40, Phase 5a): the bar's word follows each choice, never left saying the last one's.
describe('the selection bar’s Highlight, choice after choice', () => {
  it('reads Highlight again on words in none, after words that lay in one', () => {
    held = true;
    made();
    choose();
    vi.advanceTimersByTime(250);
    expect(bar()?.querySelector('button')?.textContent).toBe('Take off the highlight');
    held = false;
    choose();
    vi.advanceTimersByTime(250);
    expect(bar()?.querySelector('button')?.textContent).toBe('Highlight');
  });
});
