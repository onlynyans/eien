import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  EDGES,
  edgesOf,
  openingSight,
  pageAt,
  pageRoles,
  pagesIn,
  SPREAD_PAGE_EM,
  sightsIn,
  spreadFits,
  throughSights,
  wholeLines,
} from './pages';

describe('a chapter in pages', () => {
  it('is as tall as the whole lines its box holds, at least one', () => {
    expect(wholeLines(610, 30)).toBe(600);
    expect(wholeLines(600, 30)).toBe(600);
    expect(wholeLines(10, 30)).toBe(30);
    expect(wholeLines(610, 0)).toBe(610);
  });

  it('counts its pages from how far its columns run', () => {
    expect(pagesIn(400, 400, 48)).toBe(1);
    expect(pagesIn(400 * 3 + 48 * 2, 400, 48)).toBe(3);
    expect(pagesIn(0, 400, 48)).toBe(1);
    expect(pagesIn(1000, 0, 48)).toBe(1);
  });

  it('finds the page a word falls on, within the chapter’s pages', () => {
    expect(pageAt(0, 448, 3)).toBe(0);
    expect(pageAt(399, 448, 3)).toBe(0);
    expect(pageAt(448, 448, 3)).toBe(1);
    // A word a hair before its column, from rounding, is still on it.
    expect(pageAt(2 * 448 - 4, 448, 3)).toBe(2);
    expect(pageAt(9999, 448, 3)).toBe(2);
    expect(pageAt(-10, 448, 3)).toBe(0);
  });
});

describe('the fore-edge', () => {
  it('shows the pages read and to go in sixths, one while any are, none at an end', () => {
    expect(edgesOf(0, true)).toBe(0);
    expect(edgesOf(0, false)).toBe(EDGES);
    expect(edgesOf(0.01, true)).toBe(1);
    expect(edgesOf(0.99, false)).toBe(1);
    expect(edgesOf(1, false)).toBe(0);
    expect(edgesOf(0.5, true)).toBe(3);
  });

  it('never more than six, and as the book is read only gains before and loses after', () => {
    const through = fc.double({ min: 0, max: 1, noNaN: true });
    fc.assert(
      fc.property(through, through, (a, b) => {
        const [early, late] = a <= b ? [a, b] : [b, a];
        return (
          [early, late].every((t) => edgesOf(t, true) <= EDGES && edgesOf(t, false) <= EDGES) &&
          edgesOf(late, true) >= edgesOf(early, true) &&
          edgesOf(late, false) <= edgesOf(early, false)
        );
      }),
    );
  });
});

describe('the spread (Phase 3d)', () => {
  // Newsreader at 22px: 20em a page is 440px; margins of 72px and a 72px gutter.
  const room = 2 * 440 + 2 * 72 + 72;

  it('opens to two pages when each can have 20em, and not a pixel sooner', () => {
    expect(spreadFits(room, 22, 72, 72)).toBe(true);
    expect(spreadFits(room - 1, 22, 72, 72)).toBe(false);
    // A larger text needs more room: the page is never shrunk to fit.
    expect(spreadFits(room, 24, 72, 72)).toBe(false);
    // No text measured yet: one page.
    expect(spreadFits(room * 10, 0, 72, 72)).toBe(false);
  });

  it('needs more room for every em, and never closes as the pane widens', () => {
    const size = fc.double({ min: 8, max: 64, noNaN: true });
    const width = fc.double({ min: 0, max: 5000, noNaN: true });
    fc.assert(
      fc.property(size, width, width, (em, a, b) => {
        const [narrow, wide] = a <= b ? [a, b] : [b, a];
        const fits = (w: number) => spreadFits(w, em, 72, 72);
        return (!fits(narrow) || fits(wide)) && (!fits(wide) || wide >= 2 * SPREAD_PAGE_EM * em);
      }),
    );
  });

  it('counts a chapter’s sights, a spread’s last one half empty', () => {
    expect(sightsIn(5, 1)).toBe(5);
    expect(sightsIn(5, 2)).toBe(3);
    expect(sightsIn(4, 2)).toBe(2);
    expect(sightsIn(0, 2)).toBe(1);
  });

  it('keeps a page’s place in sight as one page opens to two and closes again', () => {
    // A sight is `per` pages a step of one page's width and gap apart (paged-place.ts): the page a
    // word falls on, found by the sight's step, is in sight whichever is shown.
    const page = fc.integer({ min: 120, max: 900 });
    const gap = fc.integer({ min: 0, max: 96 });
    fc.assert(
      fc.property(page, gap, fc.integer({ min: 1, max: 60 }), fc.nat(), (w, g, columns, pick) => {
        const column = pick % columns;
        const left = column * (w + g);
        return [1, 2].every((per) => {
          // A sight's box is `per` pages and the gaps between; its step one more gap.
          const step = per * w + (per - 1) * g + g;
          const sight = pageAt(left, step, sightsIn(columns, per));
          return sight * per <= column && column < (sight + 1) * per;
        });
      }),
    );
  });
});

describe('a page’s part in its chapter (Phase 3d)', () => {
  it('names the front matter, the opening, its pages and a spread’s empty recto', () => {
    expect(pageRoles(0, 2, 2, 7)).toEqual(['front', 'front']);
    expect(pageRoles(1, 2, 2, 7)).toEqual(['opening', 'text']);
    expect(pageRoles(3, 2, 2, 7)).toEqual(['text', 'blank']);
    expect(pageRoles(1, 1, 2, 7)).toEqual(['front']);
    expect(pageRoles(2, 1, 2, 7)).toEqual(['opening']);
    expect(pageRoles(0, 1, 0, 1)).toEqual(['opening']);
  });

  it('opens a chapter past its front matter, one page or two at a time', () => {
    expect(openingSight(0, 1)).toBe(0);
    expect(openingSight(2, 1)).toBe(2);
    expect(openingSight(2, 2)).toBe(1);
  });

  it('counts how far through from the opening, the front matter none of it', () => {
    expect(throughSights(0, 5, 0)).toBe(0);
    expect(throughSights(4, 5, 0)).toBe(1);
    expect(throughSights(2, 5, 0)).toBe(0.5);
    expect(throughSights(0, 4, 1)).toBe(0);
    expect(throughSights(1, 4, 1)).toBe(0);
    expect(throughSights(3, 4, 1)).toBe(1);
    expect(throughSights(0, 1, 0)).toBe(1);
    // A chapter of one sight past its front matter: none of it read on the front, all of it at the opening.
    expect(throughSights(0, 2, 1)).toBe(0);
    expect(throughSights(1, 2, 1)).toBe(1);
  });

  it('has the opening in sight at the opening sight, and the front only before it', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(1, 2),
        fc.constantFrom(0, 2),
        fc.integer({ min: 1, max: 40 }),
        (per, front, extra) => {
          const columns = front + extra;
          const opening = openingSight(front, per);
          const sights = sightsIn(columns, per);
          return (
            pageRoles(opening, per, front, columns).includes('opening') &&
            Array.from({ length: sights }, (_, s) => s).every(
              (s) => pageRoles(s, per, front, columns).includes('front') === s < opening,
            )
          );
        },
      ),
    );
  });
});

// QA (#40, Phase 3d): a chapter's pages read in order whichever way they're
// shown, and how far through only ever rises from its opening to its end.
describe('a chapter’s sights, read in order', () => {
  const shape = fc.record({
    per: fc.constantFrom(1, 2),
    front: fc.constantFrom(0, 2),
    pages: fc.integer({ min: 1, max: 40 }),
  });

  it('are the front matter, the opening, its pages, then blanks only on the last sight’s recto', () => {
    fc.assert(
      fc.property(shape, ({ per, front, pages }) => {
        const columns = front + pages;
        const sights = sightsIn(columns, per);
        const roles = Array.from({ length: sights }, (_, s) => pageRoles(s, per, front, columns));
        const read = roles.flat();
        const order = ['front', 'opening', 'text', 'blank'];
        const blanks = roles.flatMap((sight, s) =>
          sight.flatMap((role, i) => (role === 'blank' ? [[s, i]] : [])),
        );
        return (
          read.every(
            (role, i) => i === 0 || order.indexOf(read[i - 1] as string) <= order.indexOf(role),
          ) &&
          read.filter((role) => role === 'front').length === front &&
          read.filter((role) => role === 'opening').length === 1 &&
          read.filter((role) => role !== 'blank').length === columns &&
          blanks.every(([s, i]) => s === sights - 1 && i !== 0)
        );
      }),
    );
  });

  it('go from none of the chapter at its opening to all of it at its last, only rising', () => {
    fc.assert(
      fc.property(shape, ({ per, front, pages }) => {
        const sights = sightsIn(front + pages, per);
        const opening = openingSight(front, per);
        const through = Array.from({ length: sights }, (_, s) => throughSights(s, sights, opening));
        return (
          through.every(
            (share, s) =>
              share >= 0 && share <= 1 && (s === 0 || share >= (through[s - 1] as number)),
          ) &&
          through.slice(0, opening).every((share) => share === 0) &&
          (sights - 1 === opening || through[opening] === 0) &&
          through[sights - 1] === 1
        );
      }),
    );
  });
});
