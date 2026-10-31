// A book's bookmark marks on its sheet (#40, Phase 4b, 3d): the Page mark's
// look (../page/page-mark.ts) at the outer top of the page it marks: one
// page's at its right; a spread's verso's at its left, its recto's at its
// right. Held by a line of no height that keeps to the top of the sheet in
// sight (./bookmark.css), and left where it is as a page turns (a turn's
// copies leave it out).

import { h } from '../dom';
import { pageMark } from '../page/page-mark';
import { STAYS } from './turn/page-copy';

export class PageMarks {
  readonly #left = pageMark('bookmark', 'left');
  readonly #right = pageMark('bookmark', 'right');
  /** The holder, first in the sheet. */
  readonly element = h(
    'span',
    { class: 'epub-sheet__mark', attrs: { [STAYS]: '' } },
    this.#left,
    this.#right,
  );

  constructor() {
    this.#left.hidden = this.#right.hidden = true;
  }

  /** The verso's mark (`left`), and the recto's or one page's (`right`), each arriving anew as it appears. */
  show(left: boolean, right: boolean): void {
    for (const [mark, on] of [
      [this.#left, left],
      [this.#right, right],
    ] as const) {
      if (mark.hidden !== !on) mark.hidden = !on;
    }
  }
}
