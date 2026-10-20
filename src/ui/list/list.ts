// The note list: the index of what's selected in the sidebar, or of a
// search. Each row: the title, the date (a book's chapters: their words),
// and a line of preview.

import { h, wordButton } from '../dom';
import type { ListedNote, NoteList } from '../vault/vault-state';
import { when } from './when';

export interface ListActions {
  open(path: string): void;
  newNote(): void;
  clearSearch(): void;
}

const notes = (n: number) => `${n.toLocaleString()} ${n === 1 ? 'note' : 'notes'}`;

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

export function renderList(
  container: HTMLElement,
  list: NoteList,
  openPath: string | null,
  actions: ListActions,
): void {
  const book = list.kind === 'book';
  const row = (note: ListedNote) =>
    h(
      'li',
      {},
      h(
        'button',
        {
          class: 'note-row',
          attrs: { type: 'button', 'aria-current': note.path === openPath ? 'true' : undefined },
          on: { click: () => actions.open(note.path) },
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
  const empty =
    list.kind === 'search'
      ? h(
          'div',
          { class: 'list__empty' },
          h('p', { text: 'No notes match.' }),
          wordButton('Clear search', actions.clearSearch),
        )
      : h('div', { class: 'list__empty' }, h('p', { text: 'Nothing here yet.' }));
  container.replaceChildren(
    h(
      'header',
      { class: 'list__head' },
      h('h2', { class: 'list__heading', text: list.heading }),
      h('p', { class: 'label', text: listLabel(list) }),
      wordButton('New note', actions.newNote, { 'aria-keyshortcuts': 'Meta+N Control+N' }),
    ),
    list.notes.length > 0
      ? h('ul', { class: book ? 'rows rows--book' : 'rows' }, ...list.notes.map(row))
      : empty,
  );
}
