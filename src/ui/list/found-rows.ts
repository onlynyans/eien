// A book's Found (#40, Phase 5c; Features 2): every match of the list's
// field in the book, each a row in its words (the match among the words
// round it, cut on whole words), its page, and its chapter in pencil, a
// Marks row's look; and what the lens says while it searches, with none
// found, or with more than it shows. Drawn in the list and, with two panes,
// under the book's row on SHELF (../sidebar/shelf-book-rows.ts).

import type { Found } from '../../core/epub';
import { COUNT_LIMIT } from '../../core/find';
import { h } from '../dom';

/** A match as its row shows it. */
export type FoundRow = Found & {
  /** Its page as the book numbers them, or null for none known yet. */
  readonly page: string | null;
  /** Its chapter's name. */
  readonly chapter: string;
};

/** The book's Found: its rows so far, the words searched, and how the search stands. */
export interface FoundModel {
  readonly rows: readonly FoundRow[];
  readonly words: string;
  /** The book's title, as the line with none found names it. */
  readonly title: string;
  /** Chapters searched so far, of how many; done at the end. */
  readonly searched: number;
  readonly chapters: number;
  readonly done: boolean;
  /** More matches than the rows hold. */
  readonly more: boolean;
}

/** A match row's lasting name: its chapter and place. */
export const foundKey = (row: Found): string => `found:${row.spine}:${row.from}:${row.to}`;

/** A match's row: Enter or a click goes to it. `key` is its lasting name. */
export function foundRow(row: FoundRow, key: string, go: () => void): HTMLButtonElement {
  return h(
    'button',
    {
      class: 'contents-row mark-row found-row',
      attrs: { type: 'button', 'data-key': key },
      on: { click: go },
    },
    h(
      'span',
      { class: 'mark-row__words' },
      row.before,
      h('mark', { class: 'found-row__match', text: row.words }),
      row.after,
    ),
    ' ',
    h('span', { class: 'mark-row__page count', text: row.page ?? '' }),
    ' ',
    h('span', { class: 'mark-row__chapter', text: row.chapter }),
  );
}

/**
 * What the lens says under its rows, or in their place: still searching (a
 * line no screen reader hears each time it moves), none found, or more than
 * it shows; null with nothing to say.
 */
export function foundLine(model: FoundModel): string | null {
  if (!model.done) return `Searching… chapter ${model.searched + 1} of ${model.chapters}`;
  if (model.rows.length === 0) return `No “${model.words}” in ${model.title}.`;
  if (model.more) return `More than ${COUNT_LIMIT.toLocaleString('en')}: type more to narrow it.`;
  return null;
}
