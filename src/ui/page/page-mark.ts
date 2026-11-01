// The page's mark (the Page mark setting, appearance.facingMark, as
// data-facing-mark): a ribbon over the page's top edge, its outer corner
// turned down, or a tab at its outer edge. One look, worn by Facing pages'
// active page (./pages-row.ts), and a book's bookmarked page (#40, Phase
// 4b, ../epub/epub-page.ts); its rules are ./page-mark.css.

import { h } from '../dom';

const SVG = 'http://www.w3.org/2000/svg';

/** Which of the page's sides is its outer one, where the mark stands. */
export type MarkEdge = 'left' | 'right';

/** What a mark marks: the page you're in (Facing pages'), or a book's bookmarked page (#40). */
export type MarkOf = 'active' | 'bookmark';

/**
 * A mark, `what` it marks as its modifier (`page__mark--active`), at the
 * page's `edge`. The ribbon and the tab are the span; a dog-ear is its drawing.
 */
export function pageMark(what: MarkOf, edge: MarkEdge): HTMLElement {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  // The corner gone to the blotter, and the flap folded over the page, along the diagonal.
  for (const [part, points] of [
    ['page__mark-gone', '0,0 24,0 0,24'],
    ['page__mark-flap', '24,0 24,24 0,24'],
  ] as const) {
    const polygon = document.createElementNS(SVG, 'polygon');
    polygon.setAttribute('class', part);
    polygon.setAttribute('points', points);
    svg.append(polygon);
  }
  const mark = h(
    'span',
    { class: `page__mark page__mark--${what}`, attrs: { 'aria-hidden': 'true' } },
    svg,
  );
  markAt(mark, edge);
  return mark;
}

/** The mark moved to the page's `edge`. */
export const markAt = (mark: HTMLElement, edge: MarkEdge): void => {
  mark.dataset.edge = edge;
};
