import { describe, expect, it } from 'vitest';
import type { Epub } from '../../core/epub';
import type { BookCount } from './book-count';
import { BookFoot } from './book-foot';
import { bookPlace } from './book-place';
import type { EpubPage } from './epub-page';
import { RunningHeads } from './running-heads';
import type { PageShown } from './sight';

/** A printed edition's pages, two of them in the first chapter. */
const PRINTED = [
  { label: '1', spine: 0, offset: 0 },
  { label: '2', spine: 0, offset: 1000 },
];

interface Sheet {
  sight: readonly PageShown[];
  paged: boolean;
  /** The chapter's own pages: the first in sight (0 first), how many, how many at once. */
  page: { at: number; of: number; per: 1 | 2 };
}

/**
 * A book's place over a foot and a sheet of `sheet`, its count `count`
 * (null: none yet); the book three chapters of one size.
 */
function placed(count: unknown, sheet: Partial<Sheet> = {}) {
  const foot = new BookFoot(
    () => {},
    () => {},
  );
  const heads = new RunningHeads();
  const shown: Sheet = { sight: [], paged: false, page: { at: 0, of: 1, per: 1 }, ...sheet };
  const page = {
    foot,
    heads,
    element: document.createElement('div'),
    leaf: document.createElement('div'),
    chapter: document.createElement('div'),
    sheet: shown,
    edges: { through: () => {}, after: 0, before: 0 },
    focus: () => {},
  } as unknown as EpubPage;
  const linear = { linear: true, size: 1000 };
  const place = bookPlace({
    page,
    epub: () =>
      ({ spine: [linear, linear, linear], contents: [], title: 'The Book' }) as unknown as Epub,
    spine: () => 0,
    count: () => count as BookCount | null,
    marks: () => [],
    goTo: () => {},
  });
  const figure = (name: string) =>
    foot.figures
      .filter((each) => each.classList.contains(name))
      .map((each) => each.textContent)
      .join('|');
  const folios = () => [...heads.folio.children].map((each) => each.textContent);
  return { place, sheet: shown, said: () => figure('colophon__page'), figure, folios };
}

const text = (from: number): PageShown => ({ from, role: 'text' });
const UNPRINTED = { lengths: [4500, 3000, 3000], print: [] };

describe('where in the chapter a book’s place says, in pages (#67)', () => {
  it('is the chapter’s own page as laid out, the folio the same number', () => {
    const { place, said, folios } = placed(UNPRINTED, {
      paged: true,
      sight: [text(1600)],
      page: { at: 2, of: 12, per: 1 },
    });
    place.inSight(1600, 2000);
    expect(said()).toBe('page 3 of 12');
    expect(folios()).toEqual(['', '3']);
  });

  it('moves on by one a turn, whatever the page holds', () => {
    const { place, sheet, said, folios } = placed(UNPRINTED, {
      paged: true,
      page: { at: 0, of: 4, per: 1 },
    });
    const turns: string[] = [];
    for (let at = 0; at < 4; at++) {
      sheet.sight = [{ from: at * 100, role: at === 0 ? 'opening' : 'text' }];
      sheet.page = { at, of: 4, per: 1 };
      place.inSight(at * 100, at * 100 + 100);
      turns.push(`${said()} / ${folios()[1]}`);
    }
    expect(turns).toEqual([
      'page 1 of 4 / 1',
      'page 2 of 4 / 2',
      'page 3 of 4 / 3',
      'page 4 of 4 / 4',
    ]);
  });

  it('says both of a spread’s pages, each folio its own, and a last page alone by itself', () => {
    const { place, sheet, said, folios } = placed(UNPRINTED, {
      paged: true,
      sight: [text(100), text(200)],
      page: { at: 2, of: 5, per: 2 },
    });
    place.inSight(100, 300);
    expect(said()).toBe('pages 3–4 of 5');
    expect(folios()).toEqual(['3', '4']);
    sheet.sight = [text(400), { from: 500, role: 'blank' }];
    sheet.page = { at: 4, of: 5, per: 2 };
    place.inSight(400, 500);
    expect(said()).toBe('page 5 of 5');
    expect(folios()).toEqual(['5', '']);
  });

  // A turn moves the page (paged-place.ts #go) before it measures the sight: the slot waits for it.
  it('is said once the sight turned to is measured, never from the sight before', () => {
    const { place, sheet, said, folios } = placed(UNPRINTED, {
      paged: true,
      sight: [text(400), text(600)],
      page: { at: 2, of: 5, per: 2 },
    });
    place.inSight(400, 800);
    expect(said()).toBe('pages 3–4 of 5');
    // On to the last spread, its recto blank: the sight before would say a page past the chapter's end.
    sheet.page = { at: 4, of: 5, per: 2 };
    place.moved(0.9);
    expect(said()).toBe('pages 3–4 of 5');
    expect(folios()).toEqual(['3', '4']);
    sheet.sight = [text(800), { from: 900, role: 'blank' }];
    place.inSight(800, 900);
    expect(said()).toBe('page 5 of 5');
  });

  it('says nothing on Eien’s front matter, none of the book’s words', () => {
    const { place, said, folios } = placed(UNPRINTED, {
      paged: true,
      sight: [
        { from: 0, role: 'front' },
        { from: 0, role: 'front' },
      ],
    });
    place.inSight(0, 0);
    expect(said()).toBe('');
    expect(folios()).toEqual(['', '']);
  });

  it('is the printed page where the book has them, the folios too', () => {
    const { place, said, folios } = placed(
      { lengths: [4500, null, null], print: PRINTED },
      { paged: true, sight: [text(900), text(1200)], page: { at: 4, of: 9, per: 2 } },
    );
    place.inSight(900, 1500);
    expect(said()).toBe('pages 1–2 of 2');
    expect(folios()).toEqual(['1', '2']);
  });
});

describe('where in the chapter a book’s place says, scrolling (#67)', () => {
  it('is how far through the chapter, kept as the words in sight are measured and the book counted', () => {
    const { place, said, figure } = placed(UNPRINTED);
    place.inSight(0, 100);
    place.moved(0.4);
    expect(said()).toBe('40% of the chapter');
    // A rest measures the words in sight again, and more of the book is counted: neither takes it away.
    place.inSight(1200, 1400);
    expect(said()).toBe('40% of the chapter');
    place.counted();
    expect(said()).toBe('40% of the chapter');
    // The book's own figure, one of it, and none of the chapter's elsewhere.
    expect(figure('colophon__through')).toMatch(/^\d+% of the book$/u);
  });

  it('is the printed page where the book has them', () => {
    const { place, said } = placed({ lengths: [4500, null, null], print: PRINTED });
    place.moved(0.3);
    place.inSight(1200, 1400);
    expect(said()).toBe('page 2 of 2');
  });
});

describe('the page a book’s place says, between chapters', () => {
  it('says nothing until the chapter drawn has its words in sight measured, however much is counted', () => {
    const { place, said } = placed(UNPRINTED, {
      paged: true,
      sight: [text(0)],
      page: { at: 3, of: 9, per: 1 },
    });
    place.counted();
    expect(said()).toBe('');
    place.inSight(0, 100);
    expect(said()).toBe('page 4 of 9');
    // A chapter on its way: the last one's sight isn't this one's.
    place.clear();
    expect(said()).toBe('');
    place.counted();
    expect(said()).toBe('');
  });
});

describe('a place in the book, as its row says it', () => {
  it('is none known for a printed book’s chapter not yet counted, never the page before it', () => {
    const { place } = placed({
      lengths: [1000, null],
      print: [
        { label: '1', spine: 0, offset: 0 },
        { label: '2', spine: 1, offset: null },
      ],
    });
    expect(place.labelAt(0, 500)).toBe('1');
    expect(place.labelAt(1, 10)).toBeNull();
  });

  it('is how far through the book for a book with no page-list, once its own chapter is counted', () => {
    const { place } = placed({ lengths: [4500, null, 3000], print: [] });
    expect(place.labelAt(0, 0)).toBe('0%');
    expect(place.labelAt(0, 2250)).toBe('16%');
    expect(place.labelAt(2, 1500)).toBe('83%');
    expect(place.labelAt(1, 0)).toBeNull();
    // A place past its chapter's end (the count and the book disagreeing) stands at its end.
    expect(place.labelAt(0, 1_000_000)).toBe('33%');
  });

  it('is none known with no count yet, nor before a printed book’s first page', () => {
    expect(placed(null).place.labelAt(0, 0)).toBeNull();
    const { place } = placed({
      lengths: [200, 1000],
      print: [{ label: 'xii', spine: 1, offset: 0 }],
    });
    // The cover, before the printed edition begins.
    expect(place.labelAt(0, 100)).toBeNull();
    expect(place.labelAt(1, 0)).toBe('xii');
  });
});
