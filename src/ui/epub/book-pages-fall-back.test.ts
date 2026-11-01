// QA (#40, Phase 3d): a turn that falls back (a hand let go short) puts the
// book back exactly where it stood, Eien's title page and imprint too, which
// hold none of the book's words: the place alone (offset 0) would show the
// chapter's opening instead. The page turn is stood in for, so the test
// steps and unsteps the book as a turn's motion would.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../../core/config';
import type { Epub } from '../../core/epub';
import { bookPages } from './book-pages';
import type { EpubPage } from './epub-page';
import type { Spot } from './sight';
import type { TurnSurface } from './turn/turn-surface';

const surfaces: TurnSurface[] = [];

vi.mock('./turn/page-turn', () => ({
  PageTurn: class {
    constructor(surface: TurnSurface) {
      surfaces.push(surface);
    }
    finish() {}
    whenStill(run: () => void) {
      run();
    }
    dispose() {}
  },
}));
vi.mock('./turn/hand-events', () => ({ handEvents: () => () => {} }));

/**
 * The first chapter in pages, one at a time: the title page (0) and the
 * imprint (1), then its opening (2) and on, each page's first word a hundred
 * characters on; a place shown is the opening's page at offset 0.
 */
function firstChapter() {
  let page = 2;
  const pages = 6;
  const offsetOf = (at: number) => Math.max(0, at - 2) * 100;
  const sheet = {
    paged: true,
    get place() {
      return offsetOf(page);
    },
    get spot(): Spot {
      return { offset: offsetOf(page), page, front: page < 2 ? page : null, key: '' };
    },
    get page() {
      return page;
    },
    turn: vi.fn((way: 1 | -1) => {
      if (page + way < 0 || page + way >= pages) return false;
      page += way;
      return true;
    }),
    restore: vi.fn((spot: Spot) => {
      page = spot.front ?? spot.page;
    }),
    showPlace: vi.fn((offset: number) => {
      page = 2 + offset / 100;
    }),
    edge: vi.fn(),
    trim: vi.fn(),
  };
  let spine = 0;
  const draw = vi.fn(async (index: number) => {
    spine = index;
    return true;
  });
  bookPages({
    page: {
      leaf: document.createElement('article'),
      sheet,
      scroller: document.createElement('div'),
    } as unknown as EpubPage,
    epub: () => ({ spine: [{ linear: true }, { linear: true }] }) as unknown as Epub,
    spine: () => spine,
    draw,
    values: () => DEFAULT_SETTINGS,
    turnTo: vi.fn(async () => true),
  });
  const surface = surfaces.at(-1) as TurnSurface;
  return { sheet, surface, draw, at: () => page };
}

afterEach(() => {
  surfaces.length = 0;
});

describe('a turn from Eien’s front matter that falls back', () => {
  it('puts the imprint back, not the chapter’s opening its place would show', async () => {
    const book = firstChapter();
    book.surface.step(-1);
    expect(book.at()).toBe(1);
    // From the imprint, on to the opening, and the hand let go short.
    expect(book.surface.step(1)).toBe(true);
    expect(book.at()).toBe(2);
    await book.surface.unstep();
    expect(book.at()).toBe(1);
    expect(book.sheet.restore).toHaveBeenLastCalledWith({ offset: 0, page: 1, front: 1, key: '' });
    expect(book.sheet.showPlace).not.toHaveBeenCalled();
    expect(book.draw).not.toHaveBeenCalled();
  });

  it('puts the opening back when a turn back to the front matter falls back', async () => {
    const book = firstChapter();
    expect(book.surface.step(-1)).toBe(true);
    expect(book.at()).toBe(1);
    await book.surface.unstep();
    expect(book.at()).toBe(2);
  });

  it('never turns back past the front matter: nothing before the book’s first chapter', async () => {
    const book = firstChapter();
    book.surface.step(-1);
    book.surface.step(-1);
    expect(book.at()).toBe(0);
    expect(book.surface.step(-1)).toBe(false);
    expect(book.draw).not.toHaveBeenCalled();
  });
});
