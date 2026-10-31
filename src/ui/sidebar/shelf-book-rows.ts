// The rows under a book on SHELF with two panes (#40): its lenses (Phase
// 4c), then what the lens shows, its chapters in the book's order (the one on
// the page marked as an open note's row is), its marks, or what the field
// finds in it (Phase 5c), as the list shows them with the list in sight
// (../list/contents-list.ts).

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
  NO_MARKS,
} from '../list/book-lenses';
import { type ContentsModel, chapterKey, lensShown, marked } from '../list/contents-list';
import { type FoundModel, type FoundRow, foundKey, foundLine } from '../list/found-rows';
import { atDepth } from './depth';
import { shelfButton as button, shelfRow as row } from './shelf-row';

/** A book's contents, as a row under it lists them (two panes). */
/** A book's contents, as the rows under it list them (two panes): the list's own model, and its path. */
export type ShelfContents = Pick<ContentsModel, 'rows' | 'spine' | 'lens' | 'marks' | 'found'> & {
  readonly path: string;
};

/** What the rows under a book do. */
export interface ShelfBookActions {
  /** A contents row chosen: that spine item of the book at `path`. */
  chapter(path: string, spine: number): void;
  /** The book's lens chosen, Contents or Marks (Phase 4c). */
  lens(path: string, lens: BookLens): void;
  /** A mark's row chosen: where it is; or Delete on it: taken off. */
  goMark(path: string, row: MarkRow): void;
  unmark(path: string, row: MarkRow): void;
  /** A match's row chosen: its words shown and chosen on the page (Phase 5c). */
  goFound(path: string, row: FoundRow): void;
}

/** With Marks in the list, the book's lenses as the first row under it (Phase 4c). */
function lensRow(path: string, contents: ShelfContents, actions: ShelfBookActions, depth: number) {
  const { marks, found } = contents;
  if (!marks) return [];
  const counts = {
    contents: contents.rows.length,
    marks: marks.length,
    found: found ? found.rows.length : null,
  };
  const lenses = lensButtons(lensShown(contents), counts, (lens) => actions.lens(path, lens));
  // Not a row: it neither lights nor presses as one; its buttons do.
  return [atDepth(h('li', { class: 'tree-lenses' }, lenses), depth + 1)];
}

/** Found's rows under a book (Phase 5c): each match in its words, its page its count; then what the search says. */
function foundRows(path: string, found: FoundModel, actions: ShelfBookActions, depth: number) {
  const line = foundLine(found);
  return [
    ...found.rows.map((each) => {
      const name = button(
        `${path}:${foundKey(each)}`,
        `${each.before}${each.words}${each.after}`,
        false,
        { click: () => actions.goFound(path, each) },
        { title: each.chapter },
      );
      if (each.page) name.append(' ', h('span', { class: 'count', text: each.page }));
      return row(depth + 1, name, 'found');
    }),
    // The tree's own hint, as with no marks kept.
    ...(line ? [atDepth(h('li', { class: 'tree-hint', text: line }), depth + 1)] : []),
  ];
}

/** The rows the book's lens shows under it: its chapters, its marks, or what's found. */
function listed(path: string, contents: ShelfContents, actions: ShelfBookActions, depth: number) {
  const lens = lensShown(contents);
  if (lens === 'found' && contents.found) return foundRows(path, contents.found, actions, depth);
  if (contents.marks && lens === 'marks') {
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
