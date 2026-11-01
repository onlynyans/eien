// Two pages or one (#40, Phase 3d): a book in pages opens to a spread when
// the pane has room for two pages of at least 20em of its text, its margins
// and the gutter between (core/epub/pages.ts spreadFits). The pane decides,
// never the sheet, so the sheet widening for two never closes them again.
// A phone's width decides as the desktop's does (decided 2026-10-31): an
// upright phone never holds two, a foldable opened or a tablet may. With Two
// pages when narrow on, a book shows two pages however narrow, as two notes
// stay side by side (decided 2026-10-31), while each holds a letter. A split
// is a spread of its own (Facing pages): it never opens one.

import { spreadFits } from '../../core/epub';
import { zoomOf } from './page-columns';

const px = (value: string) => Number.parseFloat(value) || 0;

/**
 * How many pages the book's `box` shows: two where `room` (the pane) holds a spread of `chapter`'s
 * text, or at any width (`anyWidth`, ../chrome/splits.ts twoAtAnyWidth) while each page holds a
 * letter.
 */
export function spreadOf(
  box: HTMLElement,
  chapter: HTMLElement,
  room: HTMLElement,
  anyWidth = false,
): 1 | 2 {
  if (!box.closest('[data-view="pages"]')) return 1;
  if (box.closest('.page__pages[data-two]')) return 1;
  const em = px(getComputedStyle(chapter).fontSize);
  const gap = px(getComputedStyle(box).columnGap);
  // However narrow, while each page holds a letter: a box short of the gutter would lay columns of
  // no width, the chapter counted one page and its words past it out of reach.
  if (anyWidth) return (box.clientWidth - gap) / 2 >= em ? 2 : 1;
  const sheet = box.closest<HTMLElement>('.sheet');
  if (!sheet) return 1;
  const pane = getComputedStyle(room);
  // The pane's own content: its padding (the blotter round the sheet, the edge strip's room) is no page's.
  // Page width Narrow narrows the sheet below the pane's width (../page/page.css): the pages its share.
  const share = Math.min(1, px(getComputedStyle(sheet).getPropertyValue('--look-width')) || 1);
  const width = (room.clientWidth - px(pane.paddingLeft) - px(pane.paddingRight)) * share;
  // The sheet's zoom draws each of its pixels larger: its room counted in its own.
  const zoom = zoomOf(box);
  const padX = px(getComputedStyle(sheet).paddingLeft);
  return spreadFits(width / zoom, em, padX, gap) ? 2 : 1;
}
