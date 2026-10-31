// A chapter laid in pages (#40, Phase 3b, 3d): its columns as tall as the
// whole lines the box holds, one page or a spread's two to a sight, the gap
// between; the pages counted, and its front matter's (./front-matter.ts).
// The sheet widens for two pages (./epub-spread.css) before the box is
// measured.

import { pagesIn, sightsIn, wholeLines } from '../../core/epub';
import { FRONT, FRONT_PAGES } from './front-matter';

/** The columns as laid: in the chapter's own pixels. */
export interface Columns {
  /** The box's size and the pages a sight, as laid: another, and it's laid anew. */
  readonly key: string;
  readonly per: 1 | 2;
  /** A sight's width and the gap after it; a page's width; the gap. */
  readonly step: number;
  readonly column: number;
  readonly gap: number;
  /** The chapter's pages, its front matter's, and its sights. */
  readonly columns: number;
  readonly front: number;
  readonly sights: number;
}

/** Nothing laid yet: one page, none counted. */
export const UNLAID: Columns = {
  key: '',
  per: 1,
  step: 0,
  column: 0,
  gap: 0,
  columns: 1,
  front: 0,
  sights: 1,
};

/** The size the columns are laid to: its change lays them anew. */
export const keyOf = (box: HTMLElement, per: number): string =>
  box.clientWidth > 0 ? `${box.clientWidth}×${box.clientHeight}×${per}` : '';

/** `chapter` laid in `box`, `per` pages to a sight. */
export function layColumns(box: HTMLElement, chapter: HTMLElement, per: 1 | 2): Columns {
  if (box.hasAttribute('data-spread') !== (per === 2))
    box.toggleAttribute('data-spread', per === 2);
  const width = box.clientWidth;
  const line = Number.parseFloat(getComputedStyle(chapter).lineHeight) || 0;
  // The gap a column leaves before the next: the box's own padding-free gutter (./epub.css).
  const gap = Number.parseFloat(getComputedStyle(box).columnGap) || 0;
  const height = wholeLines(box.clientHeight, line);
  const column = (width - (per - 1) * gap) / per;
  // A picture's most, its page's height (./epub.css); the text's line, the grid an opening keeps to (./epub-set.css).
  chapter.style.setProperty('--epub-page-height', `${height}px`);
  chapter.style.setProperty('--line', `${line}px`);
  Object.assign(chapter.style, {
    height: `${height}px`,
    width: `${width}px`,
    // A count with the width: a width alone, rounded, could make one column of two.
    columnWidth: `${column}px`,
    columnCount: String(per),
    columnGap: `${gap}px`,
  });
  const columns = pagesIn(chapter.scrollWidth, column, gap);
  return {
    key: keyOf(box, per),
    per,
    step: width + gap,
    column,
    gap,
    columns,
    front: chapter.querySelector(`:scope > ${FRONT}`) ? FRONT_PAGES : 0,
    sights: sightsIn(columns, per),
  };
}

/** Nothing laid: the chapter as it scrolls. */
export function unlayColumns(box: HTMLElement, chapter: HTMLElement): void {
  const { style } = chapter;
  for (const name of [
    'height',
    'width',
    'columnWidth',
    'columnCount',
    'columnGap',
    'transform',
    'clipPath',
  ] as const) {
    style[name] = '';
  }
  style.removeProperty('--epub-page-height');
  style.removeProperty('--line');
  box.removeAttribute('data-spread');
}

/** How much the sheet's zoom draws each of `box`'s pixels as: rects are zoomed, sizes aren't. */
export const zoomOf = (box: HTMLElement): number =>
  box.clientWidth > 0 ? box.getBoundingClientRect().width / box.clientWidth || 1 : 1;

/** Only the sight at `at` (its left, in the chapter's pixels) drawn, and half the gap either side for a letter's overhang. */
export function clipAt(at: number, gap: number): string {
  const half = gap / 2;
  return `inset(0px ${-(at + half)}px 0px ${at - half}px)`;
}
