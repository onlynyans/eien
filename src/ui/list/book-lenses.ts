// A book's lenses over its rows (#40, Phase 4c, epub.md → Marks: In the
// list): Contents and Marks, two word buttons, the one shown pressed (the
// app's chosen-of-a-set look, as Live, Source and Reading are), each with
// its count; and a mark's row (a bookmark's or, Phase 5b, a highlight's):
// its words (the words a bookmarked page begins with, or those highlighted),
// its page, and its chapter and kind in pencil under them. Drawn in the
// list's head and, with two panes, under the book's row on SHELF
// (../sidebar/shelf-book-rows.ts). Found joins them with Find (Phase 5c,
// ./found-rows.ts).

import type { Mark } from '../../core/epub';
import { h } from '../dom';

/** Which of a book's lenses the list shows: Found while the list's field searches it (Phase 5c). */
export type BookLens = 'contents' | 'marks' | 'found';

/** A mark as its row shows it: where it is (core/epub/marks.ts), its page, and its chapter. */
export type MarkRow = Mark & {
  /** Its printed page, else how far through the book ("21%"); null for none known yet. */
  readonly page: string | null;
  /** Its chapter's name. */
  readonly chapter: string;
};

/** What the lenses answer: one chosen. */
export type ChooseLens = (lens: BookLens) => void;

const LENS_NAMES: Record<BookLens, string> = {
  contents: 'Contents',
  marks: 'Marks',
  found: 'Found',
};

/** A lens's lasting name: the keyboard stays on it through a redraw, chosen or not. */
export const lensKey = (lens: BookLens): string => `lens:${lens}`;

/**
 * The lenses, `lens` pressed, each with its count: Found's null while
 * nothing is searched, when it's there but can't be chosen (Features 2).
 */
export function lensButtons(
  lens: BookLens,
  counts: Readonly<Record<'contents' | 'marks', number> & { found: number | null }>,
  choose: ChooseLens,
): HTMLElement {
  return h(
    'div',
    { class: 'book-lenses', attrs: { role: 'group', 'aria-label': 'The book’s index' } },
    ...(['contents', 'marks', 'found'] as const).map((each) => {
      const count = counts[each];
      return h(
        'button',
        {
          class: 'word-button book-lens',
          attrs: {
            type: 'button',
            'aria-pressed': String(each === lens),
            'data-key': lensKey(each),
            disabled: count === null,
          },
          on: { click: () => choose(each) },
        },
        // A space between, so a screen reader says "Marks 2", as the eye reads it.
        LENS_NAMES[each],
        ...(count === null ? [] : [' ', h('span', { class: 'count', text: String(count) })]),
      );
    }),
  );
}

/** A mark's row's own keys. */
export const MARK_SHORTCUTS = 'Delete Backspace';

/**
 * Delete or Backspace on a mark's row: it's taken off. Plain, and once:
 * a key held down never takes off the rows that come under it, and ⌘⌫ is a
 * row's trash elsewhere, never this.
 */
export const markKeys =
  (remove: () => void) =>
  (event: KeyboardEvent): void => {
    if (event.key !== 'Delete' && event.key !== 'Backspace') return;
    if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
    event.preventDefault();
    event.stopPropagation();
    if (!event.repeat) remove();
  };

/** What a mark's row is called: its words, or with none kept its chapter's name. */
export const markName = (row: MarkRow): string => row.mark.words || row.chapter;

/** What each kind of mark is called, in words: a row's, and what `]` and `[` say. */
export const MARK_KINDS: Readonly<Record<Mark['kind'], string>> = {
  bookmark: 'bookmark',
  highlight: 'highlight',
};

/** What Marks, and `]` or `[`, say with none kept. */
export const NO_MARKS = 'Nothing kept yet. B bookmarks a page; H keeps the words you choose.';

/** What a mark's row says under its words: its chapter, and which kind of mark it is. */
export const markWhere = (row: MarkRow): string => `${row.chapter} · ${MARK_KINDS[row.kind]}`;

/**
 * A mark's row: Enter or a click goes to it, Delete or Backspace takes it
 * off. `key` is its lasting name, for the keyboard kept across a redraw.
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
      attrs: { type: 'button', 'data-key': key, 'aria-keyshortcuts': MARK_SHORTCUTS },
      on: { click: go, keydown: markKeys(remove) },
    },
    h('span', { class: 'mark-row__words', text: markName(row) }),
    ' ',
    h('span', { class: 'mark-row__page count', text: row.page ?? '' }),
    ' ',
    h('span', { class: 'mark-row__chapter', text: markWhere(row) }),
  );
}

/** A mark row's lasting name: its kind, chapter and place (a highlight's, where it ends too). */
export const markKey = (row: Mark): string =>
  row.kind === 'bookmark'
    ? `mark:bookmark:${row.mark.chapter}:${row.mark.offset}`
    : `mark:highlight:${row.mark.chapter}:${row.mark.from}:${row.mark.to}`;
