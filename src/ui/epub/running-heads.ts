// A book's running heads and folios in pages (#40, Phase 3d, Set as a
// book): what Eien knows of where you are, in the machine's voice, over and
// under the text as a printed book's. One page: the chapter at its head and
// the page's number at its outer corner. A spread: the book's title over the
// verso and the chapter over the recto, each folio at its outer corner. An
// opening page leaves its head off, the front matter has neither, and each
// keeps its line (./epub-set.css), so the text never moves. In the sheet, so
// a curling page carries its own.

import type { Epub } from '../../core/epub';
import { chapterTitle } from '../../core/epub';
import { h } from '../dom';
import type { PageShown } from './sight';

/** Two slots, the verso's and the recto's (one page uses the first's head and the second's folio). */
const pair = (cls: string, item: string) =>
  h('div', { class: cls }, h('span', { class: item }), h('span', { class: item }));

export class RunningHeads {
  readonly head = pair('epub-heads', 'epub-heads__item label');
  readonly folio = pair('epub-folios', 'epub-folios__item count');

  /**
   * The pages in `sight` of spine item `spine` of `epub`: their heads, and
   * their folios by `labelAt` (the page numbers', decided once); none for no sight.
   */
  show(
    sight: readonly PageShown[],
    epub: Epub | null,
    spine: number,
    labelAt: (offset: number) => string | null,
  ): void {
    const [verso, recto] = sight;
    if (!epub || !verso) {
      this.#put(['', ''], ['', '']);
      return;
    }
    const chapter = chapterTitle(epub.contents, spine) ?? epub.title;
    const head = (page: PageShown | undefined, words: string) =>
      page?.role === 'text' ? words : '';
    const folio = (page: PageShown | undefined) =>
      page && (page.role === 'text' || page.role === 'opening') ? (labelAt(page.from) ?? '') : '';
    if (!recto) {
      this.#put([head(verso, chapter), ''], ['', folio(verso)]);
      return;
    }
    const left = folio(verso);
    const right = folio(recto);
    // Steady pages may begin both pages on one number: the verso's says it.
    this.#put([head(verso, epub.title), head(recto, chapter)], [left, right === left ? '' : right]);
  }

  #put(heads: readonly [string, string], folios: readonly [string, string]): void {
    for (const [row, words] of [
      [this.head, heads],
      [this.folio, folios],
    ] as const) {
      words.forEach((text, i) => {
        const slot = row.children[i] as HTMLElement;
        // Only what changed: the sheet's lines move with nothing of the book's.
        if (slot.textContent !== text) slot.textContent = text;
      });
    }
  }
}
