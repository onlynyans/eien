// Whether a page has room round its sheet (#62): the sheet laid at Page
// width's Wide narrower than the page it's on, so Narrow, As set and Wide
// each set a line of their own. A phone's page, a foldable's in Panes and a
// narrow pane's are narrower than the line already: As set and Wide fill
// them alike, and Page width isn't offered there. Measured with a sheet of
// the page's own, its tokens and zoom (a book's own look on its leaf), laid
// for a moment at no height and taken away.

import { zoomOf } from '../css-zoom';
import { h } from '../dom';
import { PAGE_WIDTH } from '../settings/look-properties';

/** Whether the page whose scroll is `scroll` has room round its sheet at Wide. */
export function roomForWidths(scroll: HTMLElement): boolean {
  const ruler = h('div', { class: 'sheet page-ruler', attrs: { 'aria-hidden': 'true' } });
  ruler.style.setProperty('--look-width', String(PAGE_WIDTH.wide));
  scroll.append(ruler);
  const style = getComputedStyle(scroll);
  const padding =
    (Number.parseFloat(style.paddingLeft) || 0) + (Number.parseFloat(style.paddingRight) || 0);
  const page = (scroll.clientWidth - padding) * zoomOf(scroll);
  const wide = ruler.getBoundingClientRect().width;
  ruler.remove();
  // A page not laid out (out of sight, or a test's) has nothing to say: the room is as it was.
  return page <= 0 || wide < page - 1;
}

/** The page to measure for the notes' look: the active page if a note's, else any note's in sight. */
export function notesPage(root: ParentNode = document): HTMLElement | null {
  const note = '.page__leaf:not(.page__leaf--epub) .page__scroll';
  return (
    root.querySelector<HTMLElement>(
      `.page__leaf[data-active]:not(.page__leaf--epub) .page__scroll`,
    ) ?? root.querySelector<HTMLElement>(note)
  );
}
