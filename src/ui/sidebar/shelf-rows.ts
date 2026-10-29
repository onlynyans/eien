// SHELF's rows (#40): a lens over the one folder tree, showing every EPUB in
// the vault under the folders that hold one, at their depth. A folder is a
// label on the way to its books (always open; FOLDERS is where folders are
// chosen), and only a book is a control: it opens on the page, and answers
// as a note's row does (../list/row-events.ts) to its menu, F2 and the
// trash's key. With two panes, the open book's contents are listed under its
// row, as an open folder's notes are.

import { baseName } from '../../core/paths';
import { epubTitleOf, type FolderNode } from '../../core/vault';
import { h, type Props } from '../dom';
import { chapterKey, marked } from '../list/contents-list';
import { type Point, rowEvents } from '../list/row-events';
import { atDepth } from './depth';
import { group } from './tree';

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
}

export interface ShelfModel {
  readonly tree: FolderNode;
  /** The book on the active page: its row is marked. */
  readonly current: string | null;
  /** With two panes, the open book's contents; else null. */
  readonly contents: ShelfContents | null;
}

export interface ShelfActions {
  openEpub(path: string): void;
  /** ⌘-click or ⌘Enter: the book on a page beside the one open, as a note's row does (#40, Phase 2c). */
  openBookBeside(path: string): void;
  /** A contents row chosen: that spine item of the book at `path`. */
  chapter(path: string, spine: number): void;
  /** A book's menu (rename, move, trash), at the pointer or the row. Apart from a note's, as the sidebar takes both. */
  bookMenu(path: string, at: Point): void;
  /** Rename the book in its row, ".epub" kept. */
  renameBook(path: string): void;
  trashBook(path: string): void;
}

/** Whether `node`, or a folder in it, holds a book. */
const holdsEpub = (node: FolderNode): boolean =>
  node.epubs.length > 0 || node.folders.some(holdsEpub);

const row = (depth: number, inner: HTMLElement, kind: string) =>
  atDepth(
    h(
      'li',
      { class: `tree-row tree-row--${kind}` },
      h('span', { class: 'tree-row__twist' }),
      inner,
    ),
    depth,
  );

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

/** The rows of every book in and under `node`, its folders as labels. */
export function shelfRows(
  model: ShelfModel,
  actions: ShelfActions,
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
    const current = marked(contents);
    const chapters = contents.rows.map((entry, i) =>
      row(
        depth + 1 + entry.depth,
        button(`${path}:${chapterKey(entry)}`, entry.title, current[i] === true, {
          click: () => actions.chapter(path, entry.spine),
        }),
        'chapter',
      ),
    );
    return [own, ...group(depth, chapters)];
  });
  const folders = node.folders
    .filter(holdsEpub)
    .flatMap((folder) => [
      row(
        depth,
        h('span', { class: 'tree-row__label shelf__folder', text: folder.name }),
        'shelf-folder',
      ),
      ...group(depth, shelfRows(model, actions, folder, depth + 1)),
    ]);
  return [...folders, ...books];
}
