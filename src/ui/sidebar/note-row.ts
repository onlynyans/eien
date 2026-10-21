// A note's row in the sidebar's tree (two panes, or a search's results):
// its number in a book, its title, and its time, or a book's chapter's words.

import { h } from '../dom';
import { type RowActions, rowEvents, rowKeys } from '../list/row-events';
import { when } from '../list/when';
import type { ListedNote, NoteList } from '../vault/vault-state';
import { atDepth } from './depth';

/** How a note's row looks, besides the note itself. */
export interface NoteRowLook {
  readonly depth: number;
  /** The open row it's listed under (an openId), or "results". */
  readonly under: string;
  /** In a book: its words show, not its time. */
  readonly book: boolean;
  /** In a folder in its own order: Alt+↑ and Alt+↓ move it. */
  readonly ordered: boolean;
  /** The note on the page. */
  readonly current: boolean;
}

export const noteRowKey = (note: ListedNote, under: string) => `note:${under}:${note.path}`;

/** How `note`, in `list`, looks under `under`. */
export const lookOf = (
  note: ListedNote,
  list: NoteList,
  under: string,
  depth: number,
  openNote: string | null,
): NoteRowLook => ({
  depth,
  under,
  book: list.kind === 'book',
  ordered: list.folder !== undefined && list.sort === 'order',
  current: note.path === openNote,
});

/**
 * What the row shows, as a string, on the day `today`: the same string, the
 * same row. Its time shows to the minute ("16:40", "yesterday" after midnight).
 */
export const noteRowShows = (note: ListedNote, look: NoteRowLook, today: string): string =>
  JSON.stringify([
    look,
    note.title,
    note.ordinal ?? '',
    look.book ? note.words : Math.floor(note.modified / 60_000),
    today,
  ]);

export function noteRow(note: ListedNote, look: NoteRowLook, actions: RowActions): HTMLElement {
  return atDepth(
    h(
      'li',
      { class: 'tree-row tree-row--note' },
      h('span', { class: 'tree-row__twist' }),
      h(
        'button',
        {
          class: 'tree-row__name',
          attrs: {
            type: 'button',
            'aria-current': look.current ? 'true' : undefined,
            // The same note can be under its folder, a tag and Pinned: each row has its own key.
            'data-key': noteRowKey(note, look.under),
            'data-path': note.path,
            'aria-keyshortcuts': rowKeys(look.ordered),
          },
          on: rowEvents(note.path, actions, look.ordered),
        },
        note.ordinal ? h('span', { class: 'tree-row__ord count', text: note.ordinal }) : null,
        h('span', { class: 'tree-row__label', text: note.title }),
        h('span', {
          class: 'count',
          text: look.book ? `${note.words.toLocaleString()} w` : when(note.modified),
        }),
      ),
    ),
    look.depth,
  );
}
