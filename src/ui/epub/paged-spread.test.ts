// A chapter in pages two at a time, and the first chapter's front matter
// (#40, Phase 3d), on the tests' own layout as ./paged-place.test.ts lays it
// out: each page a hundred of the chapter's characters, 300px wide with a
// 40px gap, so a spread's box is 640px and its step 680px. The front matter
// is two pages of Eien's own before the chapter's first word.

import fc from 'fast-check';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { piecesOf } from './chapter-place';
import { FRONT_PAGES } from './front-matter';
import { CUT_END } from './page-cut';
import { PagedPlace } from './paged-place';

const WIDTH = 300;
const GAP = 40;
const STEP = WIDTH + GAP;
const PER_PAGE = 100;

/** A chapter of `paragraphs` laid `per()` pages at a time, after the front matter if `front`. */
function laidOut(paragraphs: readonly string[], options: { per?: 1 | 2; front?: boolean } = {}) {
  let per: 1 | 2 = options.per ?? 2;
  const box = document.createElement('div');
  const chapter = document.createElement('div');
  const front = options.front
    ? '<section class="epub-front"><div>Title</div><div>This copy</div></section>'
    : '';
  chapter.innerHTML = front + paragraphs.map((words) => `<p>${words}</p>`).join('');
  chapter.style.lineHeight = '20px';
  box.style.columnGap = `${GAP}px`;
  box.append(chapter);
  document.body.append(box);
  const before = options.front ? FRONT_PAGES : 0;
  const total = paragraphs.join('').length;
  Object.defineProperty(box, 'clientWidth', { get: () => per * WIDTH + (per - 1) * GAP });
  Object.defineProperty(box, 'clientHeight', { value: 610 });
  box.getBoundingClientRect = () =>
    ({ left: 0, width: box.clientWidth, top: 0, height: 610 }) as DOMRect;
  Object.defineProperty(chapter, 'scrollWidth', {
    get: () => (before + Math.ceil(total / PER_PAGE)) * STEP - GAP,
  });
  const shown = () => -Number.parseFloat(chapter.style.transform.replace('translateX(', '') || '0');
  chapter.getBoundingClientRect = () => ({ left: -shown() }) as DOMRect;
  const baseOf = (text: Node) => {
    let at = 0;
    for (const piece of piecesOf(chapter)) {
      if (piece === text) return at;
      at += piece.length;
    }
    return at;
  };
  // Each character in its page's column, the front's pages first.
  const xOf = (at: number) =>
    (before + Math.floor(at / PER_PAGE)) * STEP + (at % PER_PAGE) - shown();
  const sideOf = (range: Range) => {
    const inside = piecesOf(chapter).filter((piece) => range.intersectsNode(piece));
    const first = inside[0];
    const last = inside.at(-1);
    if (!first || !last) return { left: 0, right: 0 };
    const start = baseOf(first) + (range.startContainer === first ? range.startOffset : 0);
    const end = baseOf(last) + (range.endContainer === last ? range.endOffset : last.length) - 1;
    return { left: xOf(start), right: xOf(Math.max(start, end)) + 1 };
  };
  const moved = vi.fn();
  const rested = vi.fn();
  const inSight = vi.fn();
  const place = new PagedPlace({ box, chapter, moved, rested, inSight, sideOf, per: () => per });
  const pages = (next: 1 | 2) => {
    per = next;
    place.reshow();
  };
  return { box, chapter, place, moved, inSight, shown, pages };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
});
afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
});

describe('a spread (Phase 3d)', () => {
  it('lays two pages to a sight, each half the box less the gutter, and says so', () => {
    const { box, chapter, place } = laidOut(['a'.repeat(450)]);
    place.show(0);
    expect(chapter.style.columnWidth).toBe(`${WIDTH}px`);
    expect(chapter.style.columnCount).toBe('2');
    expect(box.hasAttribute('data-spread')).toBe(true);
    // Five pages make three sights, the last one's recto empty.
    expect(place.pages).toBe(3);
    expect(place.columns).toEqual({ at: 0, of: 5, per: 2 });
  });

  it('shows the sight holding the place, and turns a sight at a time', () => {
    const { place, shown, inSight } = laidOut(['a'.repeat(450)]);
    place.show(250);
    expect(place.page).toBe(1);
    expect(shown()).toBe(2 * STEP);
    expect(inSight).toHaveBeenLastCalledWith(2 * PER_PAGE, 4 * PER_PAGE);
    expect(place.turn(1)).toBe(true);
    expect(place.offset).toBe(4 * PER_PAGE);
    expect(place.columns).toEqual({ at: 4, of: 5, per: 2 });
    expect(place.turn(1)).toBe(false);
  });

  it('measures where each page in sight begins: the recto’s own first word, an empty one past the end', () => {
    const { place } = laidOut(['a'.repeat(450)]);
    place.show(0);
    expect(place.sight).toEqual([
      { role: 'opening', from: 0 },
      { role: 'text', from: PER_PAGE },
    ]);
    place.edge(true);
    expect(place.sight).toEqual([
      { role: 'text', from: 4 * PER_PAGE },
      { role: 'blank', from: Number.POSITIVE_INFINITY },
    ]);
  });

  it('keeps the place’s words in sight as one page opens to two and closes again', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 899 }), (offset) => {
        const { place, pages } = laidOut(['a'.repeat(900)], { per: 1 });
        place.show(offset);
        const column = Math.floor(offset / PER_PAGE);
        const one = place.page === column;
        pages(2);
        const two = place.page === Math.floor(column / 2);
        pages(1);
        document.body.replaceChildren();
        return one && two && place.page === column && place.offset === offset;
      }),
      { numRuns: 150 },
    );
  });

  it('opens its copy for a turn to the whole sight, both pages', () => {
    const { chapter, place } = laidOut(['a'.repeat(150), 'b'.repeat(350)]);
    place.show(0);
    place.turn(1);
    const copy = chapter.cloneNode(true) as HTMLElement;
    place.trim(copy);
    expect(copy.textContent).toBe('b'.repeat(200));
  });
});

describe('the front matter (Phase 3d)', () => {
  it('is never opened at: the place’s start is the chapter’s opening, past it', () => {
    for (const per of [1, 2] as const) {
      const { place, moved } = laidOut(['a'.repeat(250)], { per, front: true });
      place.show(0);
      expect(place.page).toBe(FRONT_PAGES / per);
      expect(place.sight[0]).toEqual({ role: 'opening', from: 0 });
      // The opening is the chapter's start: none of it read yet, the front none of it.
      expect(moved).toHaveBeenLastCalledWith(0);
      expect(place.columns.at).toBe(0);
      document.body.replaceChildren();
    }
  });

  it('is turned back to from the opening, holding none of the book’s words', () => {
    const { place, inSight } = laidOut(['a'.repeat(250)], { front: true });
    place.show(0);
    expect(place.turn(-1)).toBe(true);
    expect(place.page).toBe(0);
    expect(place.sight).toEqual([
      { role: 'front', from: 0 },
      { role: 'front', from: 0 },
    ]);
    expect(inSight).toHaveBeenLastCalledWith(0, 0);
    expect(place.offset).toBe(0);
    // Past it there's nothing in this chapter: the chapter before's to turn to.
    expect(place.turn(-1)).toBe(false);
  });

  it('stays in sight laid out anew, and Home and a place shown go to the opening', () => {
    const { place, pages } = laidOut(['a'.repeat(250)], { per: 1, front: true });
    place.show(0);
    place.turn(-1);
    expect(place.page).toBe(1);
    place.reshow();
    expect(place.page).toBe(1);
    // A spread: the imprint is on the front's sight.
    pages(2);
    expect(place.page).toBe(0);
    pages(1);
    place.edge(false);
    expect(place.page).toBe(2);
    place.turn(-1);
    place.show(0);
    expect(place.page).toBe(2);
  });

  it('is put back where a turn from it fell back, not at the opening', () => {
    const { place } = laidOut(['a'.repeat(250)], { per: 1, front: true });
    place.show(0);
    place.turn(-1);
    const spot = place.spot;
    place.turn(1);
    expect(place.page).toBe(2);
    place.restore(spot);
    expect(place.page).toBe(1);
    place.reshow();
    expect(place.page).toBe(1);
  });

  it('turns as the front alone on its pages, and never in the opening’s copy', () => {
    const { chapter, place } = laidOut(['a'.repeat(250)], { per: 1, front: true });
    place.show(0);
    const opening = chapter.cloneNode(true) as HTMLElement;
    place.trim(opening);
    expect(opening.querySelector('.epub-front')).toBeNull();
    expect(opening.textContent).toBe('a'.repeat(100));
    place.turn(-1);
    const imprint = chapter.cloneNode(true) as HTMLElement;
    place.trim(imprint);
    expect(imprint.querySelector('.epub-front')).not.toBeNull();
    expect(imprint.querySelector('p')).toBeNull();
    // Laid where the imprint stands: its page, second of the front's.
    expect(imprint.style.transform).toBe(`translateX(${-STEP}px)`);
  });
});

describe('a turn’s copy of a paragraph cut at the page’s foot', () => {
  it('is marked to set its lines as the page does; one that ends with the page isn’t', () => {
    const { chapter, place } = laidOut(['a'.repeat(150), 'b'.repeat(50)], { per: 1 });
    place.show(0);
    const cut = chapter.cloneNode(true) as HTMLElement;
    place.trim(cut);
    expect(cut.querySelector('p')?.hasAttribute(CUT_END)).toBe(true);
    const whole = laidOut(['a'.repeat(100), 'b'.repeat(150)], { per: 1 });
    whole.place.show(0);
    const copy = whole.chapter.cloneNode(true) as HTMLElement;
    whole.place.trim(copy);
    expect(copy.querySelector(`[${CUT_END}]`)).toBeNull();
  });
});

// QA (#40, Phase 3d): the front matter as one page opens to two and closes
// again, turned back to on a spread; and nothing of the columns left on the
// chapter once it's cleared (Scroll, another book).
describe('the front matter as the pane widens and narrows', () => {
  it('keeps the imprint in sight one page, two and one again, its place still the opening', () => {
    const { place, pages, moved } = laidOut(['a'.repeat(250)], { per: 1, front: true });
    place.show(0);
    place.turn(-1);
    expect(place.page).toBe(1);
    pages(2);
    expect(place.page).toBe(0);
    expect(place.sight.map((page) => page.role)).toEqual(['front', 'front']);
    pages(1);
    // The imprint again, not the title page beside it.
    expect(place.page).toBe(1);
    expect(place.offset).toBe(0);
    // None of the chapter read on its front matter.
    expect(moved).toHaveBeenLastCalledWith(0);
    place.turn(-1);
    pages(2);
    pages(1);
    expect(place.page).toBe(0);
  });

  it('is turned back to from a spread’s opening, and on again to the opening', () => {
    const { place, inSight } = laidOut(['a'.repeat(450)], { front: true });
    place.show(0);
    expect(place.page).toBe(1);
    expect(place.columns).toEqual({ at: 0, of: 5, per: 2 });
    expect(place.turn(-1)).toBe(true);
    expect(place.page).toBe(0);
    expect(place.sight.map((page) => page.role)).toEqual(['front', 'front']);
    expect(inSight).toHaveBeenLastCalledWith(0, 0);
    // The fore-edge counts the chapter's own pages: none read on its front matter.
    expect(place.columns).toEqual({ at: 0, of: 5, per: 2 });
    expect(place.turn(1)).toBe(true);
    expect(place.page).toBe(1);
    expect(place.sight).toEqual([
      { role: 'opening', from: 0 },
      { role: 'text', from: PER_PAGE },
    ]);
    // The last spread: its recto the chapter's last page (two front pages and five).
    place.edge(true);
    expect(place.page).toBe(3);
    expect(place.columns).toEqual({ at: 4, of: 5, per: 2 });
    expect(place.sight.map((page) => page.role)).toEqual(['text', 'blank']);
  });

  it('is put back on a spread where a turn from it fell back', () => {
    const { place } = laidOut(['a'.repeat(450)], { front: true });
    place.show(0);
    place.turn(-1);
    const spot = place.spot;
    expect(spot).toEqual({ offset: 0, page: 0, front: 0, key: '640×610×2' });
    place.turn(1);
    place.restore(spot);
    expect(place.page).toBe(0);
    expect(place.sight.map((page) => page.role)).toEqual(['front', 'front']);
    // Laid out anew, still there.
    place.reshow();
    expect(place.page).toBe(0);
  });
});

describe('a turn that fell back after the page was laid out anew', () => {
  it('shows the sight holding its place in the new layout, not the old sight’s number', () => {
    const { place, pages } = laidOut(['a'.repeat(900)], { per: 1 });
    place.show(0);
    for (let i = 0; i < 5; i++) place.turn(1);
    const spot = place.spot;
    expect(spot.page).toBe(5);
    // The pane opens to a spread mid-gesture: sight 5 there is pages 10 and 11, past the place.
    pages(2);
    place.restore(spot);
    expect(place.page).toBe(2);
    expect(place.offset).toBe(5 * 100);
  });

  it('a front page’s comes back to the front, whatever the layout', () => {
    const { place, pages } = laidOut(['a'.repeat(450)], { per: 1, front: true });
    place.show(0);
    place.turn(-1);
    const spot = place.spot;
    pages(2);
    place.turn(1);
    place.restore(spot);
    expect(place.page).toBe(0);
  });
});

describe('a chapter cleared from its pages', () => {
  it('keeps nothing of the columns: one page, no spread, no line or page height', () => {
    const { box, chapter, place } = laidOut(['a'.repeat(450)]);
    place.show(0);
    expect(chapter.style.columnCount).toBe('2');
    expect(chapter.style.getPropertyValue('--line')).toBe('20px');
    place.clear();
    expect(chapter.style.columnCount).toBe('');
    expect(chapter.style.columnWidth).toBe('');
    expect(chapter.style.getPropertyValue('--line')).toBe('');
    expect(chapter.style.getPropertyValue('--epub-page-height')).toBe('');
    expect(box.hasAttribute('data-spread')).toBe(false);
    expect(place.sight).toEqual([]);
    expect(place.columns).toEqual({ at: 0, of: 1, per: 1 });
  });
});
