import { describe, expect, it, vi } from 'vitest';
import { LeafEdges } from './leaf-edges';
import { STAYS } from './turn/page-copy';

const edges = (element: HTMLElement, side: 'before' | 'after') =>
  element.querySelectorAll(`.epub-edges__stack--${side} .epub-edges__edge`).length;

describe('a book’s fore-edge in pages', () => {
  it('stacks the pages read and to go in sixths of the book', () => {
    const leaf = new LeafEdges(() => {});
    leaf.through(0, 0, 12);
    expect([edges(leaf.element, 'before'), edges(leaf.element, 'after')]).toEqual([0, 6]);
    leaf.through(0.5, 5, 12);
    expect([edges(leaf.element, 'before'), edges(leaf.element, 'after')]).toEqual([3, 3]);
    leaf.through(1, 11, 12);
    expect([edges(leaf.element, 'before'), edges(leaf.element, 'after')]).toEqual([6, 0]);
  });

  it('turns from its edges, each saying how many of the chapter’s pages are left that way', () => {
    const turn = vi.fn();
    const leaf = new LeafEdges(turn);
    leaf.through(0.2, 3, 12);
    const [back, on] = leaf.turns as HTMLButtonElement[];
    expect(back?.getAttribute('aria-label')).toBe('Previous page');
    expect(back?.dataset.tip).toBe('Previous page · 3 pages back in the chapter');
    expect(on?.dataset.tip).toBe('Next page · 8 pages on in the chapter');
    leaf.through(0.2, 10, 12);
    expect(on?.dataset.tip).toBe('Next page · 1 page on in the chapter');
    on?.click();
    back?.click();
    expect(turn.mock.calls).toEqual([[1], [-1]]);
  });

  it('stays where it is as a page turns: a turn never copies it', () => {
    expect(new LeafEdges(() => {}).element.hasAttribute(STAYS)).toBe(true);
  });
});

// QA (#40, Phase 3d): a spread's edges turn two pages at once, and say so to
// the eye and the ear alike; the pages left are the chapter's own, counted
// past both pages in sight.
describe('a spread’s fore-edge', () => {
  it('names its buttons for two pages, its tooltips counting the pages left past both', () => {
    const leaf = new LeafEdges(() => {});
    const [back, on] = leaf.turns as HTMLButtonElement[];
    // Pages 3 and 4 of 12 in sight (0 first: 2 and 3): two read before, eight after.
    leaf.through(0.2, 2, 12, 2);
    expect(back?.getAttribute('aria-label')).toBe('Previous pages');
    expect(on?.getAttribute('aria-label')).toBe('Next pages');
    expect(back?.dataset.tip).toBe('Previous pages · 2 pages back in the chapter');
    expect(on?.dataset.tip).toBe('Next pages · 8 pages on in the chapter');
    // The last spread, its recto past the chapter's end: none on, never fewer than none.
    leaf.through(1, 10, 11, 2);
    expect(on?.dataset.tip).toBe('Next pages · 0 pages on in the chapter');
    // Closed to one page again: one page's words.
    leaf.through(0.2, 3, 12, 1);
    expect(back?.getAttribute('aria-label')).toBe('Previous page');
    expect(on?.getAttribute('aria-label')).toBe('Next page');
    expect(on?.dataset.tip).toBe('Next page · 8 pages on in the chapter');
  });
});
