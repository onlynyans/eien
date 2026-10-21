// What the sidebar would draw, as a string: the same string, the same rows.
// A save redraws the window (the watcher sees it), but a note typed in only
// changes its time, and the sidebar shows times to the minute: with two panes
// and thousands of notes open in the tree, rebuilding them on every save
// would hold up the writer's typing, so an unchanged sidebar isn't rebuilt.

import type { FolderNode } from '../../core/vault';
import type { ListedNote, NoteList } from '../vault/vault-state';

/** What a listed note shows: its title, number and words, and its time to the minute. */
const shown = (note: ListedNote) => [
  note.path,
  note.title,
  note.ordinal ?? '',
  note.words,
  Math.floor(note.modified / 60_000),
];

const listShown = (list: NoteList | null) =>
  list && [list.kind, list.sort ?? '', list.folder ?? '', list.total, list.notes.map(shown)];

/** The folder tree as drawn: names, counts and, with two panes, which notes are in each. */
const treeShown = (node: FolderNode): unknown => [
  node.path,
  node.noteCount,
  node.notes.length,
  node.folders.map(treeShown),
];

/**
 * The sidebar's model, as a string of what it draws. `today` is the day
 * drawn for: a note's "16:40" becomes "yesterday" at midnight.
 */
export function sidebarSignature(
  model: {
    readonly tree: FolderNode;
    readonly tags: unknown;
    readonly pinned: number;
    readonly selection: unknown;
    readonly open: ReadonlySet<string>;
    readonly two: boolean;
    readonly notes: ReadonlyMap<string, NoteList>;
    readonly results: NoteList | null;
    readonly openNote: string | null;
    readonly books: ReadonlySet<string>;
    readonly notice: string | null;
  },
  today: string,
): string {
  return JSON.stringify([
    today,
    treeShown(model.tree),
    model.tags,
    model.pinned,
    model.selection,
    [...model.open].sort(),
    model.two,
    [...model.notes.entries()]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([id, list]) => [id, listShown(list)]),
    listShown(model.results),
    model.openNote,
    [...model.books].sort(),
    model.notice,
  ]);
}
