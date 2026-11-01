// Two pages or one (#40, Phase 3d): a book in pages opens to a spread when
// the pane has room for two pages of at least 20em of its text, its margins
// and the gutter between (core/epub/pages.ts spreadFits). The pane decides,
// never the sheet, so the sheet widening for two never closes them again.
// That's Auto; the writer may choose One or Two instead, for the screen
// held either way (decided 2026-10-31: Pages, landscape and Pages,
// portrait, so nothing waits on a zoom or a width). A phone's width decides
// as the desktop's does. A split is a spread of its own (Facing pages): it
// never opens one.

import type { SettingValues } from '../../core/config';
import { spreadFits } from '../../core/epub';
import { zoomOf } from '../css-zoom';

const px = (value: string) => Number.parseFloat(value) || 0;

/** One page, two, or as the width allows: Pages, landscape's and portrait's choices. */
export type PagesChoice = SettingValues['epub.landscape'];

/** The two choices, the screen held wide and held tall. */
export interface PagesChoices {
  readonly landscape: PagesChoice;
  readonly portrait: PagesChoice;
}

/** `values`' choices, as a book's page wears them. */
export const pagesChoices = (values: SettingValues): PagesChoices => ({
  landscape: values['epub.landscape'],
  portrait: values['epub.portrait'],
});

/** The choice for the screen as it's held now: wider than tall is landscape. */
export const pagesNow = (choices: PagesChoices): PagesChoice =>
  matchMedia('(orientation: portrait)').matches ? choices.portrait : choices.landscape;

/**
 * How many pages the book's `box` shows as `choice` says: one, two, or (Auto) two where `room`
 * (the pane) holds a spread of `chapter`'s text. Two pages only while each holds a letter.
 */
export function spreadOf(
  box: HTMLElement,
  chapter: HTMLElement,
  room: HTMLElement,
  choice: PagesChoice = 'auto',
): 1 | 2 {
  if (choice === 'one' || !box.closest('[data-view="pages"]')) return 1;
  if (box.closest('.page__pages[data-two]')) return 1;
  const em = px(getComputedStyle(chapter).fontSize);
  const gap = px(getComputedStyle(box).columnGap);
  // Whatever the width, while each page holds a letter: a box short of the gutter would lay columns
  // of no width, the chapter counted one page and its words past it out of reach.
  if (choice === 'two') return (box.clientWidth - gap) / 2 >= em ? 2 : 1;
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
