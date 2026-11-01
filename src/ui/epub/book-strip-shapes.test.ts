// A book's shape on its page's edge (#40, Phase 4d; QA): the strip over a
// book given as it would be read, so each case a book can be (a title page
// before its contents, a note out of the reading order, its chapters in a
// part, a bookmark's chapter not yet counted, one chapter alone) is held
// apart from the fixtures' three chapters, which are none of these.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { type Bookmark, type Epub, type Highlight, marksInOrder } from '../../core/epub';
import type { BookCount } from './book-count';
import { bookStrip } from './book-strip';
import type { EpubPage } from './epub-page';

afterEach(() => document.body.replaceChildren());

interface Shape {
  /** Each spine item's size, and whether it's in the reading order. */
  readonly spine: readonly (readonly [size: number, linear?: boolean])[];
  /** The contents' rows: title, depth, spine item. */
  readonly rows: readonly (readonly [title: string, depth: number, spine: number])[];
  /** Each item's words as counted (null: not yet); the test counts more as it goes. */
  readonly lengths: (number | null)[];
  readonly marks?: readonly Bookmark[];
  readonly highlights?: readonly Highlight[];
  /** The spine item drawn. */
  readonly at?: number;
}

function shaped(shape: Shape) {
  const epub = {
    spine: shape.spine.map(([size, linear = true], i) => ({ path: `c${i}.xhtml`, size, linear })),
    contents: shape.rows.map(([title, depth, at]) => ({
      title,
      depth,
      spine: at,
      path: `c${at}.xhtml`,
      fragment: '',
    })),
  } as unknown as Epub;
  const count = { lengths: shape.lengths, print: [] } as unknown as BookCount;
  const element = document.createElement('div');
  const focus = vi.fn();
  // The page goes where the strip sends it, as a real one does, so the next key steps from there.
  let at = shape.at ?? 0;
  const goTo = vi.fn((index: number, _place: number | (() => number)) => {
    at = index;
  });
  const strip = bookStrip({
    page: { element, focus } as unknown as EpubPage,
    epub: () => epub,
    spine: () => at,
    count: () => count,
    // In the book's order, as the page's marks give them (./book-marks.ts inOrder).
    marks: () =>
      marksInOrder(
        shape.marks ?? [],
        shape.highlights ?? [],
        epub.spine.map((item) => item.path),
      ),
    goTo,
    wordsAt: (_, offset) => `page ${offset + 1}`,
  });
  document.body.append(element);
  strip.drawn();
  const slider = element.querySelector<HTMLElement>('.edge-strip') as HTMLElement;
  slider.getBoundingClientRect = () => ({ top: 0, height: 1000 }) as DOMRect;
  /** Where the strip last went: the spine item, and the offset its words give once drawn. */
  const went = () => {
    const [index, at] = goTo.mock.lastCall ?? [];
    return [index, typeof at === 'function' ? at() : at];
  };
  const press = (key: string) =>
    slider.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  const click = (y: number) => {
    slider.dispatchEvent(new PointerEvent('pointerdown', { clientY: y, button: 0, bubbles: true }));
    slider.dispatchEvent(new PointerEvent('pointerup', { clientY: y, button: 0, bubbles: true }));
  };
  const shares = (piece: string) =>
    [...slider.querySelectorAll<HTMLElement>(piece)].map((each) =>
      Number(each.style.getPropertyValue('--at')),
    );
  return { strip, slider, goTo, focus, went, press, click, shares, count: shape.lengths };
}

const mark = (chapter: string, offset: number): Bookmark => ({ chapter, offset, words: '' });

describe('a book’s shape on its edge', () => {
  it('stands a bookmark at its chapter’s start until that chapter is counted, then within it', () => {
    const book = shaped({
      spine: [[100], [100]],
      rows: [
        ['Chapter I', 0, 0],
        ['Chapter II', 0, 1],
      ],
      lengths: [40, null],
      marks: [mark('c1.xhtml', 50)],
    });
    expect(book.shares('.edge-strip__mark')).toEqual([0.5]);
    // Counted now: its words say how far in the bookmark is.
    book.count[1] = 100;
    book.strip.drawn();
    expect(book.shares('.edge-strip__mark')).toEqual([0.75]);
  });

  it('ticks each highlight where its words begin, apart from a bookmark’s tab (Phase 5b)', () => {
    const book = shaped({
      spine: [[100], [100]],
      rows: [
        ['Chapter I', 0, 0],
        ['Chapter II', 0, 1],
      ],
      lengths: [100, 100],
      marks: [mark('c0.xhtml', 50)],
      highlights: [{ chapter: 'c1.xhtml', from: 50, to: 60, words: '' }],
    });
    expect(book.shares('.edge-strip__mark')).toEqual([0.25]);
    expect(book.shares('.edge-strip__highlight')).toEqual([0.75]);
  });

  // QA (#40, Phase 5b).
  it('draws a bookmark and a highlight at one word both, a highlight in an uncounted chapter at its start, one gone none', () => {
    const book = shaped({
      spine: [[100], [100]],
      rows: [
        ['Chapter I', 0, 0],
        ['Chapter II', 0, 1],
      ],
      lengths: [100, null],
      marks: [mark('c0.xhtml', 50)],
      highlights: [
        { chapter: 'c0.xhtml', from: 50, to: 60, words: '' },
        { chapter: 'c1.xhtml', from: 50, to: 60, words: '' },
        { chapter: 'gone.xhtml', from: 0, to: 5, words: '' },
      ],
    });
    expect(book.shares('.edge-strip__mark')).toEqual([0.25]);
    expect(book.shares('.edge-strip__highlight')).toEqual([0.25, 0.5]);
    // Counted now: within its chapter, as a bookmark is.
    book.count[1] = 100;
    book.strip.drawn();
    expect(book.shares('.edge-strip__highlight')).toEqual([0.25, 0.75]);
  });

  it('shows no tab for a bookmark whose chapter isn’t in the book', () => {
    const book = shaped({
      spine: [[100]],
      rows: [['Chapter I', 0, 0]],
      lengths: [100],
      marks: [mark('gone.xhtml', 10), mark('c0.xhtml', 50)],
    });
    expect(book.shares('.edge-strip__mark')).toEqual([0.5]);
  });

  it('passes over what’s out of the reading order: no room on the strip, never gone to', () => {
    const book = shaped({
      spine: [[100], [900, false], [100]],
      rows: [
        ['Chapter I', 0, 0],
        ['A note', 0, 1],
        ['Chapter II', 0, 2],
      ],
      lengths: [100, 900, 100],
    });
    // The note stands where it falls, between them, with no length of its own.
    expect(book.shares('.edge-strip__chapter')).toEqual([0, 0.5, 0.5]);
    for (let y = 0; y <= 1000; y += 50) {
      book.click(y);
      expect(book.went()[0]).not.toBe(1);
    }
    book.click(750);
    expect(book.went()).toEqual([2, 50]);
  });

  it('goes to the share of a chapter’s words a point is at, as they’re counted once it’s drawn', () => {
    const book = shaped({
      spine: [[300], [100]],
      rows: [
        ['Chapter I', 0, 0],
        ['Chapter II', 0, 1],
      ],
      lengths: [null, null],
    });
    book.click(375);
    // Counted as it's drawn: the offset is asked for then, never before.
    book.count[0] = 1000;
    expect(book.went()).toEqual([0, 500]);
    expect(book.focus).toHaveBeenCalledOnce();
  });

  it('keeps the keyboard on itself as its keys step, and End goes to the last chapter’s end', () => {
    const book = shaped({
      spine: [[100], [100], [100]],
      rows: [
        ['Chapter I', 0, 0],
        ['Chapter II', 0, 1],
        ['Chapter III', 0, 2],
      ],
      lengths: [100, null, null],
    });
    book.press('End');
    book.count[2] = 640;
    expect(book.went()).toEqual([2, 640]);
    book.press('Home');
    expect(book.went()).toEqual([0, 0]);
    // Ten chapters on, held at the last.
    book.press('PageDown');
    expect(book.went()).toEqual([2, 0]);
    // A chapter back from the last.
    book.press('ArrowUp');
    expect(book.went()).toEqual([1, 0]);
    expect(book.focus).not.toHaveBeenCalled();
  });

  it('says the place by the chapter drawn and its words, and a point by the chapter there', () => {
    const book = shaped({
      spine: [[100], [100], [100]],
      rows: [
        ['Chapter I', 0, 0],
        ['Chapter III', 0, 2],
      ],
      lengths: [100, 100, 100],
      at: 1,
    });
    // A share that's another chapter's: the slider says the one drawn, an item with no title by its place.
    book.strip.place(0.9, 41);
    expect(book.slider.getAttribute('aria-valuetext')).toBe('Section 2, page 42');
    expect(book.slider.getAttribute('aria-valuenow')).toBe('90');
    book.slider.dispatchEvent(new PointerEvent('pointermove', { clientY: 900, bubbles: true }));
    expect(book.slider.querySelector('.edge-strip__tip')?.textContent).toBe('Chapter III, page 71');
  });

  it('draws a book of one chapter as one hairline, and a click in it stays in it', () => {
    const book = shaped({ spine: [[50]], rows: [['Chapter I', 0, 0]], lengths: [12] });
    expect(book.shares('.edge-strip__chapter')).toEqual([0]);
    book.click(500);
    expect(book.went()).toEqual([0, 6]);
    book.click(1000);
    expect(book.went()).toEqual([0, 12]);
  });
});

// The keys as the spec says them ("↑ ↓ a chapter, Page Up and Page Down ten,
// Home the book's start and End its end"). QA (Phase 4d) found each wrong as
// first built; each holds its fix.
describe('the strip’s keys at a book’s edges and in its parts', () => {
  it('↓ from a title page before the contents goes to the first chapter, never past it', () => {
    // Eien's own EPUBs (plain.epub) and most books: a title page first, not in the contents.
    const book = shaped({
      spine: [[100], [100], [100], [100]],
      rows: [
        ['Chapter I', 0, 1],
        ['Chapter II', 0, 2],
        ['Chapter III', 0, 3],
      ],
      lengths: [100, 100, 100, 100],
      at: 0,
    });
    book.press('ArrowDown');
    expect(book.went()).toEqual([1, 0]);
  });

  it('↓ in the last chapter (or a book of one) never takes the place back to its start', () => {
    const book = shaped({ spine: [[100]], rows: [['Chapter I', 0, 0]], lengths: [100] });
    book.strip.place(0.6, 60);
    book.press('ArrowDown');
    book.press('PageDown');
    // A slider at its end: ↓ does nothing, or goes on to the end, but never back to page one.
    expect(book.goTo.mock.calls.filter(([index, at]) => index === 0 && at === 0)).toEqual([]);
  });

  it('↓ steps a chapter in a book whose contents hold its chapters in a part', () => {
    // epub2.epub's shape: one top row, "Volume I", its three chapters under it.
    const book = shaped({
      spine: [[100], [100], [100]],
      rows: [
        ['Volume I', 0, 0],
        ['Chapter I', 1, 0],
        ['Chapter II', 1, 1],
        ['Chapter III', 1, 2],
      ],
      lengths: [100, 100, 100],
    });
    expect(book.shares('.edge-strip__chapter')).toHaveLength(3);
    book.press('ArrowDown');
    expect(book.went()).toEqual([1, 0]);
  });
});
