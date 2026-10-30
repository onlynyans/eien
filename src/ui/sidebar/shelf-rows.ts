// SHELF's rows (#40): a lens over the one folder tree, showing every EPUB in
// the vault under the folders that hold one, at their depth. A folder there
// is FOLDERS' own folder row: it opens and shuts (kept on this device,
// ./shelf-folds.ts; open at first), a dragged note or folder lands on it,
// and it has the folder's menu and keys, the sidebar's own. A click on its
// name opens or shuts it, as nothing lists a folder of books. A book's row
// opens it on the page, and answers as a note's row does
// (../list/row-events.ts) to its menu, F2 and the trash's key. With two
// panes, the open book's contents are listed under its row, as an open
// folder's notes are.

import { baseName } from '../../core/paths';
import { epubTitleOf, type FolderNode, onShelf } from '../../core/vault';
import { h, type Props } from '../dom';
import {
  type BookLens,
  lensButtons,
  MARK_SHORTCUTS,
  type MarkRow,
  markKey,
  markKeys,
  markName,
} from '../list/book-lenses';
import { chapterKey, marked, NO_MARKS } from '../list/contents-list';
import { type Point, rowEvents } from '../list/row-events';
import { atDepth } from './depth';
import { FOLDER_SHORTCUTS } from './row-keys';
import { group, twistButton } from './twist';

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

export interface ShelfModel {
  readonly tree: FolderNode;
  /** The book on the active page: its row is marked. */
  readonly current: string | null;
  /** With two panes, the open book's contents; else null. */
  readonly contents: ShelfContents | null;
  /** The folders shut on this device, by path. */
  readonly shut: readonly string[];
}

/** What a folder's row does on SHELF, given by the sidebar: FOLDERS' own. */
export interface ShelfFolders {
  /** Its menu, F2 and ⌥ and an arrow (./row-keys.ts). */
  events(path: string): Props['on'];
  /** Shut it, or open it. */
  fold(path: string): void;
  /** Its name as a field, while it's renamed here. */
  edit(folder: FolderNode, depth: number): HTMLElement | null;
}

/** A folder's row on SHELF, by its data-key: apart from its row in FOLDERS. */
export const shelfKey = (path: string): string => `shelf:${path}`;

export interface ShelfActions {
  openEpub(path: string): void;
  /** ⌘-click or ⌘Enter: the book on a page beside the one open, as a note's row does (#40, Phase 2c). */
  openBookBeside(path: string): void;
  /** A contents row chosen: that spine item of the book at `path`. */
  chapter(path: string, spine: number): void;
  /** The book's lens chosen, Contents or Marks (Phase 4c). */
  lens(path: string, lens: BookLens): void;
  /** A bookmark's row chosen: its page; or Delete on it: taken off. */
  goMark(path: string, row: MarkRow): void;
  unmark(path: string, row: MarkRow): void;
  /** A book's menu (rename, move, trash), at the pointer or the row. Apart from a note's, as the sidebar takes both. */
  bookMenu(path: string, at: Point): void;
  /** Rename the book in its row, ".epub" kept. */
  renameBook(path: string): void;
  trashBook(path: string): void;
}

const row = (depth: number, inner: HTMLElement, kind: string, twist?: HTMLElement) =>
  atDepth(
    h(
      'li',
      { class: `tree-row tree-row--${kind}` },
      twist ?? h('span', { class: 'tree-row__twist' }),
      inner,
    ),
    depth,
  );

/** A folder's row: its twisty and its name both open and shut it. */
function folderRow(folder: FolderNode, depth: number, open: boolean, folders: ShelfFolders) {
  const fold = () => folders.fold(folder.path);
  // Its twisty's key starts "/", as no folder's path can, so a folder named "shelf:x" in FOLDERS never shares it.
  const twist = twistButton(`/shelf/${folder.path}`, open, folder.name, fold, true);
  const name = h(
    'button',
    {
      class: 'tree-row__name',
      attrs: {
        type: 'button',
        'aria-expanded': String(open),
        'aria-keyshortcuts': FOLDER_SHORTCUTS,
        'data-key': shelfKey(folder.path),
        'data-folder': folder.path,
      },
      on: { click: fold, ...folders.events(folder.path) },
    },
    h('span', { class: 'tree-row__label shelf__folder', text: folder.name }),
  );
  return row(depth, name, 'shelf-folder', twist);
}

const button = (
  key: string,
  label: string,
  current: boolean,
  on: Props['on'],
  attrs: Record<string, string> = {},
) =>
  h(
    'button',
    {
      class: 'tree-row__name',
      attrs: {
        type: 'button',
        'data-key': key,
        'aria-current': current ? 'true' : undefined,
        ...attrs,
      },
      on,
    },
    h('span', { class: 'tree-row__label', text: label }),
  );

/** A book's row answers as a note's: a click opens it, its menu, F2 and the trash's key. */
const bookEvents = (path: string, actions: ShelfActions): Props['on'] =>
  rowEvents(
    path,
    {
      open: actions.openEpub,
      openBeside: actions.openBookBeside,
      menu: (book, at) => actions.bookMenu(book, at),
      rename: actions.renameBook,
      trash: actions.trashBook,
    },
    false,
  );

/** With Marks in the list, the book's lenses as the first row under it (Phase 4c). */
function lensRow(path: string, contents: ShelfContents, actions: ShelfActions, depth: number) {
  const { marks } = contents;
  if (!marks) return [];
  const counts = { contents: contents.rows.length, marks: marks.length };
  const lenses = lensButtons(contents.lens, counts, (lens) => actions.lens(path, lens));
  // Not a row: it neither lights nor presses as one; its buttons do.
  return [atDepth(h('li', { class: 'tree-lenses' }, lenses), depth + 1)];
}

/** The rows the book's lens shows under it: its chapters, or its bookmarks. */
function listed(path: string, contents: ShelfContents, actions: ShelfActions, depth: number) {
  if (contents.marks && contents.lens === 'marks') {
    // None kept: the tree's own hint, as a tag with no notes says how to give it some.
    if (contents.marks.length === 0)
      return [atDepth(h('li', { class: 'tree-hint', text: NO_MARKS }), depth + 1)];
    return contents.marks.map((each) => {
      const name = button(
        `${path}:${markKey(each.mark)}`,
        markName(each),
        false,
        {
          click: () => actions.goMark(path, each),
          keydown: markKeys(() => actions.unmark(path, each)),
        },
        { 'aria-keyshortcuts': MARK_SHORTCUTS, title: each.chapter },
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

/** The rows of every book in and under `node`, under its folders' rows. */
export function shelfRows(
  model: ShelfModel,
  actions: ShelfActions,
  folders: ShelfFolders,
  node = model.tree,
  depth = 0,
): HTMLElement[] {
  const books = node.epubs.flatMap((path) => {
    const own = row(
      depth,
      button(
        `epub:${path}`,
        epubTitleOf(baseName(path)),
        path === model.current,
        bookEvents(path, actions),
        {
          'data-epub': path,
          'aria-keyshortcuts': 'F2',
        },
      ),
      'epub',
    );
    const contents = model.contents?.path === path ? model.contents : null;
    if (!contents) return [own];
    return [
      own,
      ...group(depth, [
        ...lensRow(path, contents, actions, depth),
        ...listed(path, contents, actions, depth),
      ]),
    ];
  });
  const shelved = node.folders.filter(onShelf).flatMap((folder) => {
    const field = folders.edit(folder, depth);
    if (field) return [field];
    const open = !model.shut.includes(folder.path);
    const own = folderRow(folder, depth, open, folders);
    return open
      ? [own, ...group(depth, shelfRows(model, actions, folders, folder, depth + 1))]
      : [own];
  });
  return [...shelved, ...books];
}
