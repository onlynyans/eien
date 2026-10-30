// A book's lenses over its rows (#40, Phase 4c, epub.md → Marks: In the
// list): Contents and Marks, two word buttons as tabs, each with its count,
// and a bookmark's row: the words its page begins with, its page, and its
// chapter in pencil under them. Drawn in the list's head and, with two panes,
// under the book's row on SHELF (../sidebar/shelf-rows.ts). Found joins them
// with Find (Phase 5).

import type { Bookmark } from '../../core/epub';
import { h } from '../dom';

/** Which of a book's lenses the list shows. */
export type BookLens = 'contents' | 'marks';

/** A bookmark as its row shows it. */
export interface MarkRow {
  readonly mark: Bookmark;
  /** The spine item it's in. */
  readonly spine: number;
  /** Its page as the book numbers them, or null for none known yet. */
  readonly page: string | null;
  /** Its chapter's name. */
  readonly chapter: string;
}

/** What the tabs answer: a lens chosen. */
export type ChooseLens = (lens: BookLens) => void;

const LENS_NAMES: Record<BookLens, string> = { contents: 'Contents', marks: 'Marks' };

/** The two lenses as tabs, `lens` chosen; ← → between them, as a tab list's arrows go. */
export function lensTabs(
  lens: BookLens,
  counts: Record<BookLens, number>,
  choose: ChooseLens,
): HTMLElement {
  const tabs = (['contents', 'marks'] as const).map((each) =>
    h(
      'button',
      {
        class: 'word-button book-lens',
        attrs: {
          type: 'button',
          role: 'tab',
          'aria-selected': String(each === lens),
          tabindex: each === lens ? '0' : '-1',
          // The chosen tab one name: a redraw keeps the keyboard on it as the arrows choose.
          'data-key': each === lens ? 'lens' : `lens:${each}`,
        },
        on: { click: () => choose(each) },
      },
      LENS_NAMES[each],
      h('span', { class: 'count', text: String(counts[each]) }),
    ),
  );
  return h(
    'div',
    {
      class: 'book-lenses',
      attrs: { role: 'tablist', 'aria-label': 'The book’s index' },
      on: {
        keydown: (event: KeyboardEvent) => {
          if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
          event.preventDefault();
          const next = lens === 'contents' ? 'marks' : 'contents';
          choose(next);
        },
      },
    },
    ...tabs,
  );
}

/**
 * A bookmark's row: Enter or a click goes to its page, Delete or Backspace
 * takes it off. `key` is its lasting name, for the keyboard kept across a redraw.
 */
export function markRow(
  row: MarkRow,
  key: string,
  go: () => void,
  remove: () => void,
): HTMLButtonElement {
  return h(
    'button',
    {
      class: 'contents-row mark-row',
      attrs: {
        type: 'button',
        'data-key': key,
        'aria-keyshortcuts': 'Delete Backspace',
      },
      on: {
        click: go,
        keydown: (event: KeyboardEvent) => {
          if (event.key !== 'Delete' && event.key !== 'Backspace') return;
          event.preventDefault();
          event.stopPropagation();
          remove();
        },
      },
    },
    h('span', { class: 'mark-row__words', text: row.mark.words || row.chapter }),
    h('span', { class: 'mark-row__page count', text: row.page ?? '' }),
    h('span', { class: 'mark-row__chapter', text: row.chapter }),
  );
}

/** A mark row's lasting name: its chapter and place. */
export const markKey = (mark: Bookmark): string => `mark:${mark.chapter}:${mark.offset}`;
