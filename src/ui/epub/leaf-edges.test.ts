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
