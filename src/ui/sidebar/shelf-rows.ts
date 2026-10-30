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
import { chapterKey, marked } from '../list/contents-list';
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
  /** A contents row chosen: that spine item of the book at `path`. */
  chapter(path: string, spine: number): void;
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
      menu: (book, at) => actions.bookMenu(book, at),
      rename: actions.renameBook,
      trash: actions.trashBook,
    },
    false,
  );

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
