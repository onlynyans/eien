// What the sidebar would draw, but for the notes' own rows, as a string:
// the tree's frame. With two panes and thousands of notes open in the tree,
// a note opened or typed in changes only its own rows (its mark, its time,
// its place in a list by newest); rebuilding the whole tree for that held up
// the writer's typing. While the frame is the same, the notes' rows are put
// right in place (./row-cache.ts), each compared by what it shows.

import type { FolderNode } from '../../core/vault';
import type { NoteList } from '../vault/vault-state';

/** A list as the frame draws it: what it is and how it's sorted; its rows aside. */
const listShown = (list: NoteList | null) =>
  list && [list.kind, list.sort ?? '', list.folder ?? '', list.total];

/** The folder tree as drawn: names, counts and, with two panes, whether each has notes. */
const treeShown = (node: FolderNode): unknown => [
  node.path,
  node.noteCount,
  node.notes.length,
  node.folders.map(treeShown),
];

/** The sidebar's model as a string of what it draws, the notes' rows aside. */
export function sidebarSignature(model: {
  readonly tree: FolderNode;
  readonly tags: unknown;
  readonly pinned: number;
  readonly selection: unknown;
  readonly open: ReadonlySet<string>;
  readonly two: boolean;
  readonly notes: ReadonlyMap<string, NoteList>;
  readonly results: NoteList | null;
  readonly books: ReadonlySet<string>;
  readonly notice: string | null;
  readonly scheme: string;
}): string {
  return JSON.stringify([
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
    [...model.books].sort(),
    model.notice,
    model.scheme,
  ]);
}
