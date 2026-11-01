// A chapter in pages (#40, Phase 3b), on the tests' own layout: happy-dom
// lays nothing out, so each page here holds a hundred of the chapter's
// characters, a page 300px wide with a 40px gap, its box 610px tall on 20px
// lines.

import fc from 'fast-check';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { piecesOf } from './chapter-place';
import { PagedPlace } from './paged-place';
import { REST_MS } from './place-keeper';

const WIDTH = 300;
const GAP = 40;
const STEP = WIDTH + GAP;
const PER_PAGE = 100;

function laidOut(paragraphs: readonly string[], picture = -1) {
  const box = document.createElement('div');
  const chapter = document.createElement('div');
  // A picture (no words of its own) after paragraph `picture`, if asked for.
  chapter.innerHTML = paragraphs
    .map((words, i) => `<p>${words}</p>${i === picture ? '<figure><img alt=""></figure>' : ''}`)
    .join('');
  chapter.style.lineHeight = '20px';
  box.style.columnGap = `${GAP}px`;
  box.append(chapter);
  document.body.append(box);
  const total = paragraphs.join('').length;
  Object.defineProperty(box, 'clientWidth', { value: WIDTH });
  Object.defineProperty(box, 'clientHeight', { value: 610 });
  box.getBoundingClientRect = () => ({ left: 0, width: WIDTH, top: 0, height: 610 }) as DOMRect;
  Object.defineProperty(chapter, 'scrollWidth', {
    get: () => Math.ceil(total / PER_PAGE) * STEP - GAP,
    configurable: true,
  });
  const shown = () => -Number.parseFloat(chapter.style.transform.replace('translateX(', '') || '0');
  chapter.getBoundingClientRect = () => ({ left: -shown() }) as DOMRect;
  /** Where a range's characters stand: each in its page's column, moved as the chapter is. */
  const pieces = () => piecesOf(chapter);
  const baseOf = (text: Node) => {
    let at = 0;
    for (const piece of pieces()) {
      if (piece === text) return at;
      at += piece.length;
    }
    return at;
  };
  const xOf = (at: number) => Math.floor(at / PER_PAGE) * STEP + (at % PER_PAGE) - shown();
  const sideOf = (range: Range) => {
    const inside = pieces().filter((piece) => range.intersectsNode(piece));
    const first = inside[0];
    const last = inside.at(-1);
    if (!first || !last) return { left: 0, right: 0 };
    const start = baseOf(first) + (range.startContainer === first ? range.startOffset : 0);
    const end = baseOf(last) + (range.endContainer === last ? range.endOffset : last.length) - 1;
    return { left: xOf(start), right: xOf(Math.max(start, end)) + 1 };
  };
  /** A node's first box: the first character in it or after it (a picture stands at the next word). */
  const boxOf = (node: Node) => {
    const piece = pieces().find(
      (text) =>
        text === node ||
        node.contains(text) ||
        node.compareDocumentPosition(text) & Node.DOCUMENT_POSITION_FOLLOWING,
    );
    return piece ? { left: xOf(baseOf(piece)), top: 0 } : null;
  };
  const moved = vi.fn();
  const rested = vi.fn();
  const inSight = vi.fn();
  const place = new PagedPlace({ box, chapter, moved, rested, inSight, sideOf, boxOf });
  return { box, chapter, place, moved, rested, inSight, shown };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
});
afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
});

describe('a chapter in pages', () => {
  it('lays its columns whole lines tall and counts its pages', () => {
    const { chapter, place } = laidOut(['a'.repeat(250)]);
    place.show(0);
    expect(chapter.style.height).toBe('600px');
    expect(chapter.style.columnWidth).toBe(`${WIDTH}px`);
    expect(place.pages).toBe(3);
    expect(place.page).toBe(0);
  });

  it('counts its pages again once a picture it couldn’t size loads', () => {
    const { chapter, place } = laidOut(['a'.repeat(150)], 0);
    place.show(0);
    expect(place.pages).toBe(2);
    // The picture's room arrives with it (an SVG): a page of its own.
    Object.defineProperty(chapter, 'scrollWidth', { value: 3 * STEP - GAP });
    chapter.querySelector('img')?.dispatchEvent(new Event('load'));
    expect(place.pages).toBe(3);
    expect(place.turn(1)).toBe(true);
    expect(place.turn(1)).toBe(true);
  });

  it('leaves its pages be when a picture sized from its header loads', () => {
    const { chapter, place, moved } = laidOut(['a'.repeat(150)], 0);
    chapter.querySelector('img')?.setAttribute('height', '1200');
    place.show(0);
    moved.mockClear();
    chapter.querySelector('img')?.dispatchEvent(new Event('load'));
    expect(moved).not.toHaveBeenCalled();
  });

  it('shows the page holding its place, and only that page', () => {
    const { chapter, place, shown } = laidOut(['a'.repeat(250)]);
    place.show(130);
    expect(place.page).toBe(1);
    expect(shown()).toBe(STEP);
    expect(chapter.style.clipPath).toBe(
      `inset(0px ${-(STEP + GAP / 2)}px 0px ${STEP - GAP / 2}px)`,
    );
  });

  it('turns a page on, keeping its first word as the place, told once the turns rest', () => {
    const { place, rested, moved } = laidOut(['a'.repeat(250)]);
    place.show(0);
    expect(place.turn(1)).toBe(true);
    expect(place.offset).toBe(PER_PAGE);
    expect(moved).toHaveBeenLastCalledWith(0.5);
    expect(rested).not.toHaveBeenCalled();
    expect(place.turn(1)).toBe(true);
    vi.advanceTimersByTime(REST_MS);
    expect(rested).toHaveBeenCalledOnce();
    expect(rested).toHaveBeenCalledWith(2 * PER_PAGE);
    // Past the chapter's end: the next chapter's to turn to.
    expect(place.turn(1)).toBe(false);
    expect(place.page).toBe(2);
  });

  it('tells the page in sight’s words as it’s shown and turned, measured first (Phase 4)', () => {
    const { place, inSight } = laidOut(['a'.repeat(250)]);
    place.show(130);
    // Shown on its second page: from that page's first word to the next page's.
    expect(inSight).toHaveBeenLastCalledWith(PER_PAGE, 2 * PER_PAGE);
    place.turn(1);
    // The last page runs to the chapter's end.
    expect(inSight).toHaveBeenLastCalledWith(2 * PER_PAGE, Number.POSITIVE_INFINITY);
    place.turn(-1);
    place.turn(-1);
    expect(inSight).toHaveBeenLastCalledWith(0, PER_PAGE);
  });

  it('goes to the chapter’s first page and its last', () => {
    const { place } = laidOut(['a'.repeat(250)]);
    place.show(0);
    place.edge(true);
    expect(place.page).toBe(2);
    place.edge(false);
    expect(place.page).toBe(0);
    expect(place.turn(-1)).toBe(false);
  });

  it('laid out anew, shows the same words without measuring again', () => {
    const { place, rested } = laidOut(['a'.repeat(250)]);
    place.show(150);
    place.reshow();
    expect(place.offset).toBe(150);
    expect(place.page).toBe(1);
    place.keep();
    expect(rested).not.toHaveBeenCalled();
  });

  it('turns to the page of what the keyboard comes to', () => {
    const { chapter, place } = laidOut(['a'.repeat(120), 'b'.repeat(130)]);
    place.show(0);
    const second = chapter.querySelectorAll('p')[1] as HTMLElement;
    second.tabIndex = 0;
    second.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(place.page).toBe(1);
  });

  it('keeps a turn’s copy to the whole blocks round the page in sight, moved as the page is', () => {
    const { chapter, place } = laidOut(['a'.repeat(150), 'b'.repeat(100), 'c'.repeat(400), 'd']);
    place.show(0);
    place.turn(1);
    const copy = chapter.cloneNode(true) as HTMLElement;
    expect(place.trim(copy)).toBe(0);
    // From the paragraph the page before ends in to the one a page past its end, each whole.
    expect([...copy.querySelectorAll('p')].map((p) => p.textContent?.[0])).toEqual(['a', 'b', 'c']);
    expect(copy.querySelector('p')?.textContent).toBe('a'.repeat(150));
    // From the chapter's first column: moved as the page is.
    expect(copy.style.transform).toBe(`translateX(${-STEP}px)`);
  });

  it('begins a turn’s copy in the column its first block begins in, inked from its first word', () => {
    const { chapter, place } = laidOut(['a'.repeat(250), 'b'.repeat(100), 'c'.repeat(300), 'd']);
    place.show(400);
    expect(place.page).toBe(4);
    const copy = chapter.cloneNode(true) as HTMLElement;
    expect(place.trim(copy)).toBe(350);
    const [shell, first] = copy.querySelectorAll('p');
    // The paragraph before, a hidden shell: the first is set as one after another.
    expect(shell?.style.display).toBe('none');
    expect(first?.textContent).toBe('c'.repeat(300));
    // Its column the page's fourth (index 3): the copy moved one page across, not four.
    expect(copy.style.transform).toBe(`translateX(${-STEP}px)`);
  });

  it('carries a picture that begins the page in the turn’s copy', () => {
    const { chapter, place } = laidOut(['a'.repeat(100), 'b'.repeat(150)], 0);
    place.show(0);
    place.turn(1);
    const copy = chapter.cloneNode(true) as HTMLElement;
    place.trim(copy);
    expect(copy.querySelector('img')).not.toBeNull();
    expect(copy.textContent).toBe(`${'a'.repeat(100)}${'b'.repeat(150)}`);
  });

  it('shows any place on the page holding it, and turned on and back keeps its page’s first word', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 649 }), (offset) => {
        const { place } = laidOut(['a'.repeat(250), 'b'.repeat(400)]);
        place.show(offset);
        const page = Math.floor(offset / PER_PAGE);
        if (place.page !== page) return false;
        const turned = place.turn(1);
        if (turned) place.turn(-1);
        document.body.replaceChildren();
        return place.page === page && (!turned || place.offset === page * PER_PAGE);
      }),
      { numRuns: 200 },
    );
  });

  it('let go, leaves the chapter as it was drawn', () => {
    const { chapter, place } = laidOut(['a'.repeat(250)]);
    place.show(130);
    place.clear();
    expect(chapter.style.transform).toBe('');
    expect(chapter.style.columnWidth).toBe('');
    expect(chapter.style.getPropertyValue('--epub-page-height')).toBe('');
  });
});

// QA (#40, phone spread): a word the window hyphenated across a page break. The window's own
// measure (no sideOf given): the character after the break stands at the next page's first line,
// but its range holds the hyphen too, at the end of the page before's last line, as Chromium
// draws it. Laid out anew (a Fold turned, two pages closing to one and back), the place there
// opened a page early, its words on the page after the one shown.
describe('a word hyphenated across a page, as the window measures it', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows the page its place’s character stands on, never the one its hyphen ends', () => {
    const { box, chapter } = laidOut(['a'.repeat(250)]);
    const shown = () =>
      -Number.parseFloat(chapter.style.transform.replace('translateX(', '') || '0');
    const xOf = (at: number) => Math.floor(at / PER_PAGE) * STEP + (at % PER_PAGE) - shown();
    const box1 = (left: number) => ({ left, right: left + 1, width: 1, top: 0, bottom: 20 });
    /** Each character's box; the second page's first broken from the first page's last, its hyphen after it. */
    const rectsOf = (range: Range) => {
      const rects = [];
      for (let at = range.startOffset; at < range.endOffset; at++) {
        if (at === PER_PAGE) rects.push(box1(xOf(PER_PAGE - 1) + 1));
        rects.push(box1(xOf(at)));
      }
      return rects as DOMRect[];
    };
    vi.spyOn(Range.prototype, 'getClientRects').mockImplementation(function (this: Range) {
      return rectsOf(this) as unknown as DOMRectList;
    });
    vi.spyOn(Range.prototype, 'getBoundingClientRect').mockImplementation(function (this: Range) {
      const rects = rectsOf(this);
      const left = Math.min(...rects.map((rect) => rect.left));
      const right = Math.max(...rects.map((rect) => rect.right));
      return { left, right, width: right - left, top: 0, bottom: 20 } as DOMRect;
    });
    const place = new PagedPlace({
      box,
      chapter,
      moved: vi.fn(),
      rested: vi.fn(),
      inSight: vi.fn(),
    });
    place.show(PER_PAGE);
    expect(place.page).toBe(1);
    // Turned back and on, the place is that character still, and its page shown.
    place.turn(-1);
    place.turn(1);
    expect(place.offset).toBe(PER_PAGE);
    expect(place.page).toBe(1);
    place.dispose();
  });
});
