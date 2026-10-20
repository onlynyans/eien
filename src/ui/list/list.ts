// The note list: the index of what's selected in the sidebar.

import { h, wordButton } from '../dom';
import type { NoteList } from '../vault/vault-state';
import { when } from './when';

export interface ListActions {
  open(path: string): void;
  newNote(): void;
}

export function renderList(
  container: HTMLElement,
  list: NoteList,
  openPath: string | null,
  actions: ListActions,
): void {
  const count = `${list.notes.length.toLocaleString()} ${list.notes.length === 1 ? 'note' : 'notes'}`;
  const rows = list.notes.map((note) =>
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
        h('span', { class: 'note-row__meta count', text: when(note.modified) }),
      ),
    ),
  );
  container.replaceChildren(
    h(
      'header',
      { class: 'list__head' },
      h('h2', { class: 'list__heading', text: list.heading }),
      h('p', { class: 'label', text: list.book ? `${count} · Book` : count }),
      wordButton('New note', actions.newNote, { 'aria-keyshortcuts': 'Meta+N Control+N' }),
    ),
    rows.length > 0
      ? h('ul', { class: list.book ? 'rows rows--book' : 'rows' }, ...rows)
      : h('p', { class: 'list__empty', text: 'Nothing here yet.' }),
  );
}
