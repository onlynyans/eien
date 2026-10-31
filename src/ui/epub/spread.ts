// Two pages or one (#40, Phase 3d): a book in pages opens to a spread when
// the pane has room for two pages of at least 20em of its text, its margins
// and the gutter between (core/epub/pages.ts spreadFits). The pane decides,
// never the sheet, so the sheet widening for two never closes them again.
// A phone is one page always, and a split is a spread of its own (Facing
// pages): neither opens one.

import { spreadFits } from '../../core/epub';

const px = (value: string) => Number.parseFloat(value) || 0;

/** How many pages the book's `box` shows: two where `room` (the pane) holds a spread of `chapter`'s text. */
export function spreadOf(box: HTMLElement, chapter: HTMLElement, room: HTMLElement): 1 | 2 {
  if (!box.closest('[data-view="pages"]')) return 1;
  if (box.closest('.shell[data-phone], .page__pages[data-two]')) return 1;
  const sheet = box.closest<HTMLElement>('.sheet');
  if (!sheet) return 1;
  const pane = getComputedStyle(room);
  // The pane's own content: its padding (the blotter round the sheet, the edge strip's room) is no page's.
  const width = room.clientWidth - px(pane.paddingLeft) - px(pane.paddingRight);
  // The sheet's zoom draws each of its pixels larger: its room counted in its own.
  const zoom = box.clientWidth > 0 ? box.getBoundingClientRect().width / box.clientWidth || 1 : 1;
  const em = px(getComputedStyle(chapter).fontSize);
  const padX = px(getComputedStyle(sheet).paddingLeft);
  const gap = px(getComputedStyle(box).columnGap);
  return spreadFits(width / zoom, em, padX, gap) ? 2 : 1;
}
