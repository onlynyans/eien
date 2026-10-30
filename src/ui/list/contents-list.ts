// A book's contents in the list (#40), in place of notes while the book is
// the one chosen on the shelf: its title and author, then its chapters in
// the book's order, the one on the page marked as an open note's row is.
// ↑ ↓ Home End move between them; Enter or a click opens one. A row is no
// note's: nothing drags it, and it has no menu. With Marks in the list
// (Phase 4c), its lenses under the head: Contents, or its bookmarks
// (./book-lenses.ts).

import { h } from '../dom';
import { type BookLens, lensTabs, type MarkRow, markKey, markRow } from './book-lenses';
import { moveBetween } from './list';

export interface ContentsModel {
  readonly title: string;
  readonly author: string;
  readonly rows: readonly {
    readonly title: string;
    readonly depth: number;
    readonly spine: number;
  }[];
  /** The spine item on the page: its row is marked. */
  readonly spine: number;
  /** The lens shown, and the book's bookmarks in its order; null for no lenses (Marks on the edge, Phase 4d). */
  readonly lens: BookLens;
  readonly marks: readonly MarkRow[] | null;
}

/** What the list's rows do: a chapter opened, a lens chosen, a bookmark gone to or taken off. */
export interface ContentsActions {
  chapter(spine: number): void;
  lens(lens: BookLens): void;
  go(row: MarkRow): void;
  remove(row: MarkRow): void;
}

/** What Marks says with none kept yet. */
export const NO_MARKS = 'Nothing kept yet. B bookmarks a page.';

/** The words under the heading: "Jane Austen · 61 chapters". */
const countOf = (model: ContentsModel) => {
  const count = `${model.rows.length} ${model.rows.length === 1 ? 'chapter' : 'chapters'}`;
  return model.author ? `${model.author} · ${count}` : count;
};

/** A row's lasting name, in the list and under a book's row on SHELF: its spine item and title. */
export const chapterKey = (row: ContentsModel['rows'][number]): string =>
  `chapter:${row.spine}:${row.title}`;

/**
 * Which rows are marked as the chapter on the page: the first whose spine
 * item it is, as a part and its first chapter may start in one file.
 */
export function marked(model: Pick<ContentsModel, 'rows' | 'spine'>): boolean[] {
  const at = model.rows.findIndex((row) => row.spine === model.spine);
  return model.rows.map((_, i) => i === at);
}

/** The rows under Marks: each bookmark, or the line that says there are none. */
function markRows(model: ContentsModel, actions: ContentsActions): HTMLElement {
  const marks = model.marks ?? [];
  if (marks.length === 0) return h('p', { class: 'list__empty', text: NO_MARKS });
  return h(
    'ul',
    {
      class: 'rows rows--contents',
      attrs: { 'aria-label': `Bookmarks in ${model.title}` },
      on: { keydown: moveBetween('.contents-row') },
    },
    ...marks.map((row) =>
      h(
        'li',
        {},
        markRow(
          row,
          markKey(row.mark),
          () => actions.go(row),
          () => actions.remove(row),
        ),
      ),
    ),
  );
}

/** Draw `model` in the list's pane, with the window's news. */
export function renderContents(
  container: HTMLElement,
  model: ContentsModel,
  notice: string | null,
  actions: ContentsActions,
): void {
  const active = document.activeElement;
  const focused =
    active instanceof HTMLElement && container.contains(active) ? active.dataset.key : undefined;
  const current = marked(model);
  const { marks } = model;
  const lens = marks ? model.lens : 'contents';
  container.replaceChildren(
    h(
      'header',
      { class: 'list__head' },
      h('h2', { class: 'list__heading', text: model.title }),
      h('p', { class: 'label list__count', text: countOf(model) }),
      ...(marks
        ? [
            lensTabs(lens, { contents: model.rows.length, marks: marks.length }, (chosen) =>
              actions.lens(chosen),
            ),
          ]
        : []),
    ),
    h('p', {
      class: 'list__notice',
      text: notice ?? '',
      attrs: { role: 'status', hidden: !notice },
    }),
    lens === 'marks'
      ? markRows(model, actions)
      : h(
          'ul',
          {
            class: 'rows rows--contents',
            attrs: { 'aria-label': `Contents of ${model.title}` },
            on: { keydown: moveBetween('.contents-row') },
          },
          ...model.rows.map((row, i) => {
            const item = h(
              'li',
              {},
              h(
                'button',
                {
                  class: 'contents-row',
                  attrs: {
                    type: 'button',
                    'data-key': chapterKey(row),
                    'aria-current': current[i] ? 'true' : undefined,
                  },
                  on: { click: () => actions.chapter(row.spine) },
                },
                h('span', { class: 'contents-row__title', text: row.title }),
              ),
            );
            item.style.setProperty('--depth', String(row.depth));
            return item;
          }),
        ),
  );
  if (focused === undefined) return;
  [...container.querySelectorAll<HTMLElement>('[data-key]')]
    .find((control) => control.dataset.key === focused)
    ?.focus();
}
