// The rows under a book on SHELF with two panes (#40): its lenses (Phase
// 4c), then what the lens shows, its chapters in the book's order (the one on
// the page marked as an open note's row is) or its marks, as the list
// shows them with the list in sight (../list/contents-list.ts).

import { h } from '../dom';
import {
  type BookLens,
  lensButtons,
  MARK_SHORTCUTS,
  type MarkRow,
  markKey,
  markKeys,
  markName,
  markWhere,
} from '../list/book-lenses';
import { chapterKey, marked, NO_MARKS } from '../list/contents-list';
import { atDepth } from './depth';
import { shelfButton as button, shelfRow as row } from './shelf-row';

/** A book's contents, as a row under it lists them (two panes). */
export interface ShelfContents {
  readonly path: string;
  readonly rows: readonly {
    readonly title: string;
    readonly depth: number;
    readonly spine: number;
  }[];
  /** The spine item on the page: its row is marked. */
  readonly spine: number;
  /** Its lens, and its bookmarks; null for no lenses (Marks on the edge, Phase 4d). */
  readonly lens: BookLens;
  readonly marks: readonly MarkRow[] | null;
}

/** What the rows under a book do. */
export interface ShelfBookActions {
  /** A contents row chosen: that spine item of the book at `path`. */
  chapter(path: string, spine: number): void;
  /** The book's lens chosen, Contents or Marks (Phase 4c). */
  lens(path: string, lens: BookLens): void;
  /** A mark's row chosen: where it is; or Delete on it: taken off. */
  goMark(path: string, row: MarkRow): void;
  unmark(path: string, row: MarkRow): void;
}

/** With Marks in the list, the book's lenses as the first row under it (Phase 4c). */
function lensRow(path: string, contents: ShelfContents, actions: ShelfBookActions, depth: number) {
  const { marks } = contents;
  if (!marks) return [];
  const counts = { contents: contents.rows.length, marks: marks.length };
  const lenses = lensButtons(contents.lens, counts, (lens) => actions.lens(path, lens));
  // Not a row: it neither lights nor presses as one; its buttons do.
  return [atDepth(h('li', { class: 'tree-lenses' }, lenses), depth + 1)];
}

/** The rows the book's lens shows under it: its chapters, or its bookmarks. */
function listed(path: string, contents: ShelfContents, actions: ShelfBookActions, depth: number) {
  if (contents.marks && contents.lens === 'marks') {
    // None kept: the tree's own hint, as a tag with no notes says how to give it some.
    if (contents.marks.length === 0)
      return [atDepth(h('li', { class: 'tree-hint', text: NO_MARKS }), depth + 1)];
    return contents.marks.map((each) => {
      const name = button(
        `${path}:${markKey(each)}`,
        markName(each),
        false,
        {
          click: () => actions.goMark(path, each),
          keydown: markKeys(() => actions.unmark(path, each)),
        },
        { 'aria-keyshortcuts': MARK_SHORTCUTS, title: markWhere(each) },
      );
      if (each.page) name.append(' ', h('span', { class: 'count', text: each.page }));
      return row(depth + 1, name, 'mark');
    });
  }
  const current = marked(contents);
  return contents.rows.map((entry, i) =>
    row(
      depth + 1 + entry.depth,
      button(`${path}:${chapterKey(entry)}`, entry.title, current[i] === true, {
        click: () => actions.chapter(path, entry.spine),
      }),
      'chapter',
    ),
  );
}

/** The rows under the book at `path`, a row at `depth`: its lenses, then what the lens shows. */
export const bookRows = (
  path: string,
  contents: ShelfContents,
  actions: ShelfBookActions,
  depth: number,
): HTMLElement[] => [
  ...lensRow(path, contents, actions, depth),
  ...listed(path, contents, actions, depth),
];
