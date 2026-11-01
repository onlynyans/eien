import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../../core/config';
import type { Epub } from '../../core/epub';
import { bookPages } from './book-pages';
import type { EpubPage } from './epub-page';

/** A book of three chapters on a page whose sheet turns `pages` within each, its motion instant. */
function book(pages = 2) {
  const leaf = document.createElement('article');
  leaf.innerHTML = '<div class="epub-chapter">Words</div>';
  document.body.append(leaf);
  let at = 0;
  let spine = 1;
  const sheet = {
    paged: true,
    get place() {
      return at * 10;
    },
    turn: vi.fn((way: 1 | -1) => {
      if (at + way < 0 || at + way >= pages) return false;
      at += way;
      return true;
    }),
    edge: vi.fn((last: boolean) => {
      at = last ? pages - 1 : 0;
    }),
    showPlace: vi.fn((offset: number) => {
      at = offset / 10;
    }),
    trim: vi.fn(),
  };
  const draw = vi.fn(async (index: number, place: number | (() => number)) => {
    spine = index;
    at = 0;
    if (typeof place === 'function') place();
    return true;
  });
  const epub = {
    spine: [{ linear: true }, { linear: true }, { linear: false }, { linear: true }],
  } as unknown as Epub;
  const turns = bookPages({
    page: { leaf, sheet, scroller: document.createElement('div') } as unknown as EpubPage,
    epub: () => epub,
    spine: () => spine,
    draw,
    values: () => ({ ...DEFAULT_SETTINGS, 'epub.turnSpeed': '0' }),
    turnTo: vi.fn(async () => true),
  });
  const setSpine = (index: number) => {
    spine = index;
  };
  return { turns, sheet, draw, at: () => at, spine: () => spine, setSpine };
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('a book turned page by page', () => {
  it('turns within the chapter, then on into the next chapter’s first page', async () => {
    const b = book();
    b.turns.turn(1, false);
    expect(b.at()).toBe(1);
    expect(b.draw).not.toHaveBeenCalled();
    b.turns.turn(1, false);
    await vi.waitFor(() => expect(b.draw).toHaveBeenCalledWith(3, 0));
    expect(b.spine()).toBe(3);
  });

  it('back from a chapter’s first page, to the last page of the one before', async () => {
    const b = book();
    b.turns.turn(-1, false);
    await vi.waitFor(() => expect(b.draw).toHaveBeenCalledWith(0, expect.any(Function)));
    expect(b.sheet.edge).toHaveBeenCalledWith(true);
    expect(b.at()).toBe(1);
  });

  it('turns nothing while a book opens, nor in Scroll', async () => {
    const opening = book();
    opening.setSpine(-1);
    opening.turns.turn(1, false);
    opening.turns.edge(true);
    await Promise.resolve();
    expect(opening.draw).not.toHaveBeenCalled();
    expect(opening.sheet.turn).not.toHaveBeenCalled();
    const scrolling = book();
    scrolling.sheet.paged = false;
    scrolling.turns.turn(1, false);
    expect(scrolling.sheet.turn).not.toHaveBeenCalled();
  });

  it('goes to the chapter’s ends, and stops at the book’s', async () => {
    const b = book();
    b.turns.edge(true);
    expect(b.at()).toBe(1);
    b.turns.turn(1, false);
    await vi.waitFor(() => expect(b.spine()).toBe(3));
    b.turns.edge(true);
    b.turns.turn(1, false);
    await Promise.resolve();
    expect(b.draw).toHaveBeenCalledOnce();
  });
});
