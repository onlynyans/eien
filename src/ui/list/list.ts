// The note list: the index of what's selected in the sidebar, or of a
// search (narrowed to that list's notes, from the field on the list's band,
// ./search-field.ts). Each row: the title, the date (a book's chapters: their words),
// and a line of preview. A row is dragged, right-clicked, or worked from the
// keyboard (./row-events.ts).

import { filtering } from '../../core/tags';
import { h, wordButton } from '../dom';
import { WINDOW_FROM } from '../shell/window-range';
import { WindowedRows } from '../shell/windowed-rows';
import type { ListedNote, NoteList } from '../vault/vault-state';
import { type LensActions, lensLine, lensParts } from './lens-bar';
import { noteCount as notes } from './note-count';
import { type RowActions, rowEvents, rowKeys } from './row-events';
import { when } from './when';

export interface ListActions extends RowActions, LensActions {
  newNote(): void;
  clearSearch(): void;
}

export { SORT_NAMES } from './lens-bar';

/** What an empty list says, where there's a way to fill it. */
const EMPTY: Partial<Record<NoteList['kind'], string>> = {
  pinned: 'Nothing pinned yet. Pin a note from its menu, or with ⇧⌘P (Ctrl+Shift+P) on its row.',
  tag: 'No notes carry this tag yet. Add it to a note’s tags.',
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
  // Filtered: how many of how many.
  if (list.of !== undefined) {
    const of = `${list.total.toLocaleString()} of ${notes(list.of)}`;
    return list.kind === 'book' ? `${of} · Book` : list.kind === 'tag' ? `${of} · Tag` : of;
  }
  if (list.kind === 'book') return `${notes(list.total)} · Book`;
  if (list.kind === 'tag') return `${notes(list.total)} · Tag`;
  return notes(list.total);
}

/** Each list pane's long list (../shell/windowed-rows.ts), kept from draw to draw. */
const windows = new WeakMap<HTMLElement, WindowedRows>();

/** What a row shows, as a string: the same string, the same element. */
const rowShows = (note: ListedNote, book: boolean, ordered: boolean, open: boolean) =>
  JSON.stringify([
    note.title,
    note.ordinal ?? '',
    book ? note.words : Math.floor(note.modified / 60_000),
    note.preview,
    ordered,
    open,
    new Date().toDateString(),
  ]);

export function renderList(
  container: HTMLElement,
  list: NoteList,
  openPath: string | null,
  actions: ListActions,
  notice: string | null = null,
): void {
  const book = list.kind === 'book';
  // In its own order, and nothing filtered out: rows can be moved between the others.
  const ordered =
    list.folder !== undefined &&
    list.sort === 'order' &&
    !(list.filter !== undefined && filtering(list.filter));
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

  const lens = lensParts(list, actions);
  const empty =
    list.kind === 'search'
      ? h(
          'div',
          { class: 'list__empty' },
          h('p', { text: 'No notes match.' }),
          wordButton('Clear search', actions.clearSearch),
        )
      : h(
          'div',
          { class: 'list__empty' },
          h('p', {
            text:
              list.filter !== undefined && filtering(list.filter)
                ? 'No note here passes that filter.'
                : (EMPTY[list.kind] ?? 'Nothing here yet.'),
          }),
        );
  // Thousands of notes: one list that draws the rows in sight, kept with its scroll position.
  const long = list.notes.length >= WINDOW_FROM;
  let windowed = windows.get(container);
  if (long && !windowed) {
    windowed = new WindowedRows(h('ul', { class: 'rows' }), 64);
    windows.set(container, windowed);
  }
  const scrolled = windowed?.element.scrollTop ?? 0;
  if (long && windowed) {
    windowed.element.className = book ? 'rows rows--book' : 'rows';
    windowed.set(
      list.notes.map((note) => ({
        key: note.path,
        shows: rowShows(note, book, ordered, note.path === openPath),
        make: () => row(note),
      })),
    );
  }
  // A redraw mustn't take the keyboard's place: the row that had focus has it again.
  const rowsBefore = [...container.querySelectorAll<HTMLElement>('.note-row[data-path]')];
  const active =
    document.activeElement instanceof HTMLElement && container.contains(document.activeElement)
      ? document.activeElement
      : null;
  const focused = active?.dataset.path;
  // A lens control the keyboard was on; a chip's × goes with its chip, to the filter's button.
  const focusedKey =
    active?.dataset.key ?? (active?.closest('.list__lens') ? 'lens-filter:list' : undefined);
  const focusedAt = rowsBefore.findIndex((row) => row.dataset.path === focused);
  container.replaceChildren(
    h(
      'header',
      { class: 'list__head' },
      h('h2', { class: 'list__heading', text: list.heading }),
      h('p', { class: 'label list__count', text: listLabel(list) }),
      wordButton('New note', actions.newNote, { 'aria-keyshortcuts': 'Meta+N Control+N' }),
      lens.controls.length > 0 ? h('span', { class: 'list__tools' }, ...lens.controls) : null,
      lens.chips,
    ),
    ...[lensLine(list)].filter((line) => line !== null),
    h('p', {
      class: 'list__notice',
      text: notice ?? '',
      attrs: { role: 'status', hidden: !notice },
    }),
    long && windowed
      ? windowed.element
      : list.notes.length > 0
        ? h('ul', { class: book ? 'rows rows--book' : 'rows' }, ...list.notes.map(row))
        : empty,
  );
  if (long && windowed) {
    windowed.element.scrollTop = scrolled;
    windowed.render();
    if (focused !== undefined && windowed.focusKey(focused)) return;
  }
  if (focused === undefined && focusedKey !== undefined) {
    container.querySelector<HTMLElement>(`[data-key="${CSS.escape(focusedKey)}"]`)?.focus();
  }
  if (focused !== undefined) {
    const rows = [...container.querySelectorAll<HTMLElement>('.note-row[data-path]')];
    // The same note; or, if it's gone (trashed, moved away), the one now in its place.
    const same = rows.find((row) => row.dataset.path === focused);
    (same ?? (focusedAt >= 0 ? rows[Math.min(focusedAt, rows.length - 1)] : undefined))?.focus();
  }
}
