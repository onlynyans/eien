// The note list: the index of what's selected in the sidebar, or of a
// search (narrowed to that list's notes, from the field on the list's band,
// ./search-field.ts). Each row: the title, the date (a book's chapters: their words),
// and a line of preview. A row is dragged, right-clicked, or worked from the
// keyboard (./row-events.ts).

import { filtering } from '../../core/tags';
import { addButton } from '../add-button';
import { h, wordButton } from '../dom';
import { icon } from '../icons';
import { WINDOW_FROM } from '../shell/window-range';
import { WindowedRows } from '../shell/windowed-rows';
import type { ListedNote, NoteList } from '../vault/vault-state';
import {
  type Arrange,
  inOwnOrder,
  type LensActions,
  lensLine,
  lensParts,
  NO_ARRANGE,
} from './lens-bar';
import { noteCount as notes } from './note-count';
import { type RowActions, rowEvents, rowKeys } from './row-events';
import { type ShownNotes, shownAttrs } from './shown-notes';
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
/** Which list each pane drew last (`placeOf`): drawn again, it keeps its scroll. */
const drawn = new WeakMap<HTMLElement, string>();
/** The row each pane's keyboard was on as the pane shut, to go back to (`focusList`). */
const left = new WeakMap<HTMLElement, string>();

/** The same list, as a redraw sees it: another one (a folder, a sort) starts at the top. */
const placeOf = (list: NoteList) =>
  JSON.stringify([list.kind, list.heading, list.folder ?? '', list.sort ?? '']);

/** The pane shuts with the keyboard on a row: that row is where `focusList` goes back to. */
export function keepPlace(container: HTMLElement): void {
  const active = document.activeElement;
  const path =
    active instanceof HTMLElement && container.contains(active)
      ? active.closest<HTMLElement>('.note-row[data-path]')?.dataset.path
      : undefined;
  if (path !== undefined) left.set(container, path);
  else left.delete(container);
}

/** The row the list shut on, else the list's open note, or its first row, or (empty) its first control. */
export function focusList(container: HTMLElement): void {
  const path = left.get(container);
  left.delete(container);
  const windowed = windows.get(container);
  if (path !== undefined && windowed?.element.isConnected && windowed.focusKey(path)) return;
  const rows = [...container.querySelectorAll<HTMLElement>('.note-row')];
  const target =
    rows.find((row) => row.dataset.path === path) ??
    rows.find((row) => row.getAttribute('aria-current') === 'true') ??
    rows[0] ??
    container.querySelector<HTMLElement>('button');
  target?.focus();
}

/** What a row shows, as a string: the same string, the same element. */
const rowShows = (note: ListedNote, book: boolean, ordered: boolean, shown: ShownNotes) =>
  JSON.stringify([
    note.title,
    note.ordinal ?? '',
    book ? note.words : Math.floor(note.modified / 60_000),
    note.preview,
    ordered,
    note.path === shown.active,
    note.path === shown.other,
    new Date().toDateString(),
  ]);

export function renderList(
  container: HTMLElement,
  list: NoteList,
  shown: ShownNotes,
  actions: ListActions,
  notice: string | null = null,
  arrange: Arrange = NO_ARRANGE,
): void {
  const book = list.kind === 'book';
  // Arranging: each row shows its grip.
  const grips = arrange.on && inOwnOrder(list);
  // In your order, nothing filtered out: ⌥↑ ⌥↓ move a row (a drag too, as Arranging says).
  const ordered = inOwnOrder(list);
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
            ...shownAttrs(note.path, shown),
            'aria-keyshortcuts': rowKeys(ordered),
          },
          on: rowEvents(note.path, actions, ordered),
        },
        grips ? h('span', { class: 'note-row__grip' }, icon('grip')) : null,
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

  const lens = lensParts(list, actions, 'list', arrange);
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
  // A redraw mustn't take the keyboard's place: the row that had focus has it again. Read before
  // the long list is given its rows, which hands the keyboard to the list while it redraws.
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
  // Thousands of notes: one list that draws the rows in sight, kept with its scroll position.
  const long = list.notes.length >= WINDOW_FROM;
  let windowed = windows.get(container);
  if (long && !windowed) {
    windowed = new WindowedRows(h('ul', { class: 'rows' }), 64);
    windows.set(container, windowed);
  }
  // The same list drawn again (news from the disk, the pane opened again) keeps its scroll,
  // though a short one's rows are a new element.
  const place = placeOf(list);
  const scrolled =
    drawn.get(container) === place
      ? (container.querySelector<HTMLElement>(':scope > .rows')?.scrollTop ?? 0)
      : 0;
  drawn.set(container, place);
  if (long && windowed) {
    windowed.element.className = `${book ? 'rows rows--book' : 'rows'}${grips ? ' is-arranging' : ''}`;
    windowed.set(
      list.notes.map((note) => ({
        key: note.path,
        shows: rowShows(note, book, ordered, shown) + (grips ? 'g' : ''),
        make: () => row(note),
      })),
    );
  }
  container.replaceChildren(
    h(
      'header',
      { class: 'list__head quiet-row' },
      h('h2', { class: 'list__heading', text: list.heading }),
      h('p', { class: 'label list__count', text: listLabel(list) }),
      // A control is an icon (#26): the same quiet + as the sidebar's, its key in its tooltip.
      addButton({ label: 'New note', key: 'new-note', keys: 'Mod-n', run: actions.newNote }),
      lens.controls.length > 0 ? h('span', { class: 'list__tools' }, ...lens.controls) : null,
      lens.chips,
    ),
    ...[lensLine(list, arrange)].filter((line) => line !== null),
    h('p', {
      class: 'list__notice',
      text: notice ?? '',
      attrs: { role: 'status', hidden: !notice },
    }),
    long && windowed
      ? windowed.element
      : list.notes.length > 0
        ? h(
            'ul',
            { class: `${book ? 'rows rows--book' : 'rows'}${grips ? ' is-arranging' : ''}` },
            ...list.notes.map(row),
          )
        : empty,
  );
  const scroller = container.querySelector<HTMLElement>(':scope > .rows');
  if (scroller) scroller.scrollTop = scrolled;
  if (long && windowed) {
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
