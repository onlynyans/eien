// SHELF's rows (#40): a lens over the one folder tree, showing every EPUB in
// the vault under the folders that hold one, at their depth. A folder is a
// label on the way to its books (always open; FOLDERS is where folders are
// chosen), and only a book is a control: it opens on the page. With two
// panes, the open book's contents are listed under its row, as an open
// folder's notes are.

import { baseName } from '../../core/paths';
import { epubTitleOf, type FolderNode } from '../../core/vault';
import { h } from '../dom';
import { chapterKey, marked } from '../list/contents-list';
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
  /** A contents row chosen: that spine item of the book at `path`. */
  chapter(path: string, spine: number): void;
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

const button = (key: string, label: string, current: boolean, run: () => void) =>
  h(
    'button',
    {
      class: 'tree-row__name',
      attrs: { type: 'button', 'data-key': key, 'aria-current': current ? 'true' : undefined },
      on: { click: run },
    },
    h('span', { class: 'tree-row__label', text: label }),
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
      button(`epub:${path}`, epubTitleOf(baseName(path)), path === model.current, () =>
        actions.openEpub(path),
      ),
      'epub',
    );
    const contents = model.contents?.path === path ? model.contents : null;
    if (!contents) return [own];
    const current = marked(contents);
    const chapters = contents.rows.map((entry, i) =>
      row(
        depth + 1 + entry.depth,
        button(`${path}:${chapterKey(entry)}`, entry.title, current[i] === true, () =>
          actions.chapter(path, entry.spine),
        ),
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
