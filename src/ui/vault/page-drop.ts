// A note dragged from the list or the tree onto the page pane (spec §4): onto
// the right of a lone page, past the share the split's mode says, it opens
// beside it; onto a page, it opens there. While it's over the pane, raised
// paper shows where the page would stand, and says what would happen.

import { h } from '../dom';
import type { PageDrop } from '../list/drag';
import type { Pages, Side } from './pages';

export function pageDrop(pages: Pages, open: (path: string, beside: boolean) => void): PageDrop {
  const label = h('span', { class: 'drop-preview__label label' });
  const preview = h('div', { class: 'drop-preview', attrs: { 'aria-hidden': 'true' } }, label);
  /** Where a drop would land: a new page beside, or the page it's over. */
  let target: 'beside' | Side | null = null;
  const leave = () => {
    target = null;
    preview.remove();
  };

  return {
    over(x, y) {
      const area = pages.pane.pagesArea;
      const box = area.getBoundingClientRect();
      if (x < box.left || x > box.right || y < box.top || y > box.bottom) {
        leave();
        return false;
      }
      // Folded, one of the two shows: it's taken for a lone page. Two, the one under the
      // pointer (a companion under the page, too).
      const { drop } = pages.mode;
      const shown = pages.sides.filter(({ page }) => page.element.checkVisibility());
      if (shown.length < 2)
        target = (x - box.left) / box.width > drop.past ? 'beside' : pages.active;
      else
        target =
          shown.find(({ page }) => {
            const at = page.element.getBoundingClientRect();
            return x >= at.left && x <= at.right && y >= at.top && y <= at.bottom;
          }) ?? null;
      if (!target) {
        leave();
        return false;
      }
      const at = target === 'beside' ? null : target.page.element.getBoundingClientRect();
      const edges = {
        left: at ? at.left - box.left : box.width * drop.past,
        right: at ? box.right - at.right : 0,
        top: at ? at.top - box.top : 0,
        bottom: at ? box.bottom - at.bottom : 0,
      };
      for (const [edge, px] of Object.entries(edges))
        preview.style.setProperty(`--drop-${edge}`, `${px}px`);
      const name = target === 'beside' ? '' : target.page.name;
      label.textContent =
        target === 'beside' ? drop.label : `Open here${name ? `, in place of ${name}` : ''}`;
      if (preview.parentElement !== area) area.append(preview);
      return true;
    },
    drop(path) {
      const landing = target;
      leave();
      if (landing === 'beside') open(path, true);
      else if (landing) {
        pages.activate(landing);
        open(path, false);
      }
    },
    leave,
  };
}
