// A book's contents in the list (#40), in place of notes while the book is
// the one chosen on the shelf: its title and author, then its chapters in
// the book's order, the one on the page marked as an open note's row is.
// ↑ ↓ Home End move between them; Enter or a click opens one. A row is no
// note's: nothing drags it, and it has no menu.

import { h } from '../dom';
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
}

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

/** Draw `model` in the list's pane, with the window's news; `choose`, a row's chapter opened. */
export function renderContents(
  container: HTMLElement,
  model: ContentsModel,
  notice: string | null,
  choose: (spine: number) => void,
): void {
  const active = document.activeElement;
  const focused =
    active instanceof HTMLElement && container.contains(active) ? active.dataset.key : undefined;
  const current = marked(model);
  container.replaceChildren(
    h(
      'header',
      { class: 'list__head' },
      h('h2', { class: 'list__heading', text: model.title }),
      h('p', { class: 'label list__count', text: countOf(model) }),
    ),
    h('p', {
      class: 'list__notice',
      text: notice ?? '',
      attrs: { role: 'status', hidden: !notice },
    }),
    h(
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
              on: { click: () => choose(row.spine) },
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
