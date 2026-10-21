// The note list: the index of what's selected in the sidebar, or of a
// search (narrowed to that list's notes, from the field on the list's band,
// ./search-field.ts). Each row: the title, the date (a book's chapters: their words),
// and a line of preview. A row is dragged, right-clicked, or worked from the
// keyboard (./row-events.ts).

import { h, wordButton } from '../dom';
import { openMenu } from '../menu/menu';
import type { ListedNote, NoteList, NoteSort } from '../vault/vault-state';
import { noteCount as notes } from './note-count';
import { type RowActions, rowEvents, rowKeys } from './row-events';
import { when } from './when';

export interface ListActions extends RowActions {
  newNote(): void;
  clearSearch(): void;
  sort(sort: NoteSort): void;
}

export const SORT_NAMES: Record<NoteSort, string> = {
  order: 'Order',
  title: 'Title',
  modified: 'Newest',
};

/** The line under the heading: how many, and what kind of list. */
export function listLabel(list: NoteList): string {
  if (list.kind === 'search') {
    const within = list.within ? ` · ${list.within}` : '';
    if (list.total === 0) return `No notes match${within}`;
    const matched = `${notes(list.total)} ${list.total === 1 ? 'matches' : 'match'}`;
    return list.total > list.notes.length
      ? `${matched} · the first ${list.notes.length.toLocaleString()}${within}`
      : `${matched}${within}`;
  }
  if (list.kind === 'book') return `${notes(list.total)} · Book`;
  if (list.kind === 'tag') return `${notes(list.total)} · Tag`;
  return notes(list.total);
}

export function renderList(
  container: HTMLElement,
  list: NoteList,
  openPath: string | null,
  actions: ListActions,
  notice: string | null = null,
): void {
  const book = list.kind === 'book';
  const ordered = list.folder !== undefined && list.sort === 'order';
  const row = (note: ListedNote) =>
    h(
      'li',
      {},
      h(
        'button',
        {
          class: 'note-row',
          attrs: {
            type: 'button',
            'data-path': note.path,
            'aria-current': note.path === openPath ? 'true' : undefined,
            'aria-keyshortcuts': rowKeys(ordered),
          },
          on: rowEvents(note.path, actions, ordered),
        },
        note.ordinal ? h('span', { class: 'note-row__ord count', text: note.ordinal }) : null,
        h('span', { class: 'note-row__title', text: note.title }),
        h('span', {
          class: 'note-row__meta count',
          text: book ? `${note.words.toLocaleString()} w` : when(note.modified),
        }),
        h('span', {
          class: note.preview ? 'note-row__preview' : 'note-row__preview is-empty',
          text: note.preview || 'Empty',
        }),
      ),
    );

  const sort =
    list.sorts.length > 0 && list.sort
      ? wordButton(
          SORT_NAMES[list.sort],
          () =>
            openMenu(
              list.sorts.map((choice) => ({
                label: SORT_NAMES[choice],
                checked: choice === list.sort,
                run: () => actions.sort(choice),
              })),
              { opener: sortButton },
              'Sort',
            ),
          {
            class: 'word-button list__sort',
            'aria-haspopup': 'menu',
            'aria-label': `Sorted by ${SORT_NAMES[list.sort].toLowerCase()}`,
            title: ordered ? 'In the folder’s own order: drag to reorder' : undefined,
          },
        )
      : null;
  const sortButton = sort as HTMLButtonElement;

  const empty =
    list.kind === 'search'
      ? h(
          'div',
          { class: 'list__empty' },
          h('p', { text: 'No notes match.' }),
          wordButton('Clear search', actions.clearSearch),
        )
      : h('div', { class: 'list__empty' }, h('p', { text: 'Nothing here yet.' }));
  // A redraw mustn't take the keyboard's place: the row that had focus has it again.
  const rowsBefore = [...container.querySelectorAll<HTMLElement>('.note-row[data-path]')];
  const focused =
    document.activeElement instanceof HTMLElement && container.contains(document.activeElement)
      ? document.activeElement.dataset.path
      : undefined;
  const focusedAt = rowsBefore.findIndex((row) => row.dataset.path === focused);
  container.replaceChildren(
    h(
      'header',
      { class: 'list__head' },
      h('h2', { class: 'list__heading', text: list.heading }),
      h('p', { class: 'label list__count', text: listLabel(list) }),
      wordButton('New note', actions.newNote, { 'aria-keyshortcuts': 'Meta+N Control+N' }),
      sort,
    ),
    h('p', {
      class: 'list__notice',
      text: notice ?? '',
      attrs: { role: 'status', hidden: !notice },
    }),
    list.notes.length > 0
      ? h('ul', { class: book ? 'rows rows--book' : 'rows' }, ...list.notes.map(row))
      : empty,
  );
  if (focused !== undefined) {
    const rows = [...container.querySelectorAll<HTMLElement>('.note-row[data-path]')];
    // The same note; or, if it's gone (trashed, moved away), the one now in its place.
    const same = rows.find((row) => row.dataset.path === focused);
    (same ?? (focusedAt >= 0 ? rows[Math.min(focusedAt, rows.length - 1)] : undefined))?.focus();
  }
}
