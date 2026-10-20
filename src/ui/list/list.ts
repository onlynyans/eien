// The note list: the index of what's selected in the sidebar, or of a
// search. Each row: the title, the date (a book's chapters: their words),
// and a line of preview. A row is dragged, right-clicked, or worked from the
// keyboard: F2 renames, ⌘⌫ (Ctrl+Delete) sends it to the trash, Alt+↑/↓
// moves it in a folder's own order.

import { h, wordButton } from '../dom';
import { openMenu } from '../menu/menu';
import type { ListedNote, NoteList, NoteSort } from '../vault/vault-state';
import { when } from './when';

export interface ListActions {
  open(path: string): void;
  newNote(): void;
  clearSearch(): void;
  sort(sort: NoteSort): void;
  /** The row's menu, at the pointer or the row. */
  menu(path: string, at: { readonly x: number; readonly y: number }): void;
  /** One place up or down, in a folder's own order. */
  nudge(path: string, by: -1 | 1): void;
  rename(path: string): void;
  trash(path: string): void;
}

const notes = (n: number) => `${n.toLocaleString()} ${n === 1 ? 'note' : 'notes'}`;

export const SORT_NAMES: Record<NoteSort, string> = {
  order: 'Order',
  title: 'Title',
  modified: 'Newest',
};

/** The line under the heading: how many, and what kind of list. */
export function listLabel(list: NoteList): string {
  if (list.kind === 'search') {
    if (list.total === 0) return 'No notes match';
    const matched = `${notes(list.total)} ${list.total === 1 ? 'matches' : 'match'}`;
    return list.total > list.notes.length
      ? `${matched} · the first ${list.notes.length.toLocaleString()}`
      : matched;
  }
  if (list.kind === 'book') return `${notes(list.total)} · Book`;
  if (list.kind === 'tag') return `${notes(list.total)} · Tag`;
  return notes(list.total);
}

const isMac = /Mac|iPhone|iPad/.test(navigator.platform);

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
            'aria-keyshortcuts': ordered ? 'Alt+ArrowUp Alt+ArrowDown F2' : 'F2',
          },
          on: {
            click: () => actions.open(note.path),
            contextmenu: (event) => {
              event.preventDefault();
              const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
              // From the keyboard (the menu key, Shift+F10) there's no pointer: under the row's start.
              const fromKeys = event.clientX === 0 && event.clientY === 0;
              actions.menu(
                note.path,
                fromKeys
                  ? { x: rect.left + 16, y: rect.bottom }
                  : { x: event.clientX, y: event.clientY },
              );
            },
            keydown: (event) => {
              const mod = isMac ? event.metaKey : event.ctrlKey;
              if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
                const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
                actions.menu(note.path, { x: rect.left + 16, y: rect.bottom });
              } else if (event.key === 'F2') actions.rename(note.path);
              else if (mod && (event.key === 'Backspace' || event.key === 'Delete'))
                actions.trash(note.path);
              else if (ordered && event.altKey && event.key === 'ArrowUp')
                actions.nudge(note.path, -1);
              else if (ordered && event.altKey && event.key === 'ArrowDown')
                actions.nudge(note.path, 1);
              else return;
              event.preventDefault();
            },
          },
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
  const focused =
    document.activeElement instanceof HTMLElement && container.contains(document.activeElement)
      ? document.activeElement.dataset.path
      : undefined;
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
    [...container.querySelectorAll<HTMLElement>('.note-row[data-path]')]
      .find((row) => row.dataset.path === focused)
      ?.focus();
  }
}
