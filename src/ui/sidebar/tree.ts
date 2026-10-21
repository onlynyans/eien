// The sidebar's rows: Library (All Notes, Pinned), Folders and Tags. With
// two panes the tree lists the notes too: under an open folder, after its
// own folders, and under All Notes, Pinned and each tag; and a search's
// results take the tree's place while there's no note list to show them.

import type { TagNode } from '../../core/tags';
import type { FolderNode } from '../../core/vault';
import { h, type Props } from '../dom';
import type { RowActions } from '../list/row-events';
import type { ListedNote, NoteList, Selection } from '../vault/vault-state';
import { atDepth } from './depth';
import { lookOf, noteRow, noteRowKey, noteRowShows } from './note-row';
import type { RowCache } from './row-cache';

export interface TreeModel {
  readonly tree: FolderNode;
  readonly tags: readonly TagNode[];
  /** How many notes are pinned (the row shows when there are some). */
  readonly pinned: number;
  readonly selection: Selection;
  /** What's shown open: folder paths, tags (tagId) and, with two panes, All Notes and Pinned. */
  readonly open: ReadonlySet<string>;
  /** Two panes: the tree lists the notes. */
  readonly two: boolean;
  /** With two panes, the notes under each open row, by openId; the vault's own under "". */
  readonly notes: ReadonlyMap<string, NoteList>;
  /** A search's results, when there's no note list to show them; else null. */
  readonly results: NoteList | null;
  /** The note on the page. */
  readonly openNote: string | null;
  /** The folders that are books, marked BOOK. */
  readonly books: ReadonlySet<string>;
}

export interface TreeActions extends RowActions {
  select(selection: Selection): void;
  /** Open or close a row, by its openId. */
  toggle(id: string): void;
  /** A folder's menu, at the pointer or under the row. */
  folderMenu(path: string, at: { readonly x: number; readonly y: number }): void;
}

/**
 * The id a row is opened (and, with two panes, its notes listed) by: a
 * folder's path; the others start with "/", which no folder's path can, so a
 * folder named "#drafts" is never taken for the tag.
 */
export const openId = (selection: Selection): string =>
  selection.kind === 'folder'
    ? selection.path
    : selection.kind === 'tag'
      ? `/#${selection.key}`
      : `/${selection.kind}`;

/** The row an openId names; null for one that isn't a row's. */
export function selectionOf(id: string): Selection | null {
  if (!id.startsWith('/')) return { kind: 'folder', path: id };
  if (id.startsWith('/#')) return id.length > 2 ? { kind: 'tag', key: id.slice(2) } : null;
  return id === '/all' ? { kind: 'all' } : id === '/pinned' ? { kind: 'pinned' } : null;
}

const tagId = (key: string) => openId({ kind: 'tag', key });

/** A row's lasting name, for giving it the keyboard back after a redraw. */
export const keyOf = (selection: Selection): string =>
  selection.kind === 'folder'
    ? `folder:${selection.path}`
    : selection.kind === 'tag'
      ? `tag:${selection.key}`
      : selection.kind;

const same = (a: Selection, b: Selection) => keyOf(a) === keyOf(b);

/** The list id a search's results are drawn under (a row's data-key says "results" too). */
export const RESULTS = 'results';

/** The disclosure triangle, drawn so it turns (to its button's aria-expanded) rather than swaps. */
export const twisty = (): HTMLElement =>
  h('span', { class: 'twisty', attrs: { 'aria-hidden': 'true' } });

/**
 * An open row's rows, in a group of their own at the row's depth: the
 * hairline guide down its children runs down the group (spec §4; the
 * mockup's `.tree [role='group']`). Nothing under it, no group.
 */
const group = (depth: number, rows: HTMLElement[]): HTMLElement[] =>
  rows.length > 0
    ? [atDepth(h('li', { class: 'tree-group' }, h('ul', { class: 'tree' }, ...rows)), depth)]
    : [];

export class TreeRows {
  readonly #model: TreeModel;
  readonly #actions: TreeActions;
  /** A folder's own keys and menu, given by the sidebar (F2 renames it there). */
  readonly #folderEvents: (path: string) => Props['on'];
  /** The note rows drawn before, kept where they show the same. */
  readonly #cache: RowCache;
  /** The day drawn for: a note's "16:40" becomes "yesterday" at midnight. */
  readonly #today = new Date().toDateString();

  constructor(
    model: TreeModel,
    actions: TreeActions,
    folderEvents: (path: string) => Props['on'],
    cache: RowCache,
  ) {
    this.#model = model;
    this.#actions = actions;
    this.#folderEvents = folderEvents;
    this.#cache = cache;
  }

  library(): HTMLElement[] {
    const rows = this.#branch('All Notes', 'All Notes', this.#model.tree.noteCount, {
      kind: 'all',
    });
    if (this.#model.pinned === 0) return rows;
    return [...rows, ...this.#branch('Pinned', 'Pinned', this.#model.pinned, { kind: 'pinned' })];
  }

  /** A folder's folders (and, with two panes, its notes), each open one's within it. */
  folders(
    node: FolderNode,
    depth: number,
    edit: (folder: FolderNode, depth: number) => HTMLElement | null,
  ): HTMLElement[] {
    const own = node.folders.flatMap((folder) => {
      const field = edit(folder, depth);
      if (field) return [field];
      const selection: Selection = { kind: 'folder', path: folder.path };
      const parent = folder.folders.length > 0 || (this.#model.two && folder.notes.length > 0);
      const row = this.#row(
        folder.name,
        folder.noteCount,
        selection,
        depth,
        parent ? this.#twist(folder.path, folder.name) : undefined,
      );
      return this.#model.open.has(folder.path)
        ? [row, ...group(depth, this.folders(folder, depth + 1, edit))]
        : [row];
    });
    return [...own, ...this.noteRows(openId({ kind: 'folder', path: node.path }), depth)];
  }

  tags(nodes: readonly TagNode[], depth: number): HTMLElement[] {
    return nodes.flatMap((tag) => {
      const label = h('span', {}, h('span', { class: 'tree-row__hash', text: '#' }), tag.name);
      const selection: Selection = { kind: 'tag', key: tag.key };
      const parent = tag.children.length > 0 || (this.#model.two && tag.count > 0);
      const id = tagId(tag.key);
      const row = this.#row(
        label,
        tag.count,
        selection,
        depth,
        parent ? this.#twist(id, `#${tag.tag}`) : undefined,
      );
      return this.#model.open.has(id)
        ? [
            row,
            ...group(depth, [
              ...this.tags(tag.children, depth + 1),
              ...this.noteRows(id, depth + 1),
            ]),
          ]
        : [row];
    });
  }

  /** A Library row (they hold notes only with two panes), and the notes under it when it's open. */
  #branch(label: string, name: string, count: number, selection: Selection): HTMLElement[] {
    const id = openId(selection);
    const opener = this.#model.two ? this.#twist(id, name) : undefined;
    const row = this.#row(label, count, selection, 0, opener);
    return [row, ...(this.#model.open.has(id) ? group(0, this.noteRows(id, 1)) : [])];
  }

  #twist(id: string, name: string): HTMLElement {
    const open = this.#model.open.has(id);
    return h(
      'button',
      {
        class: 'tree-row__twist',
        attrs: {
          type: 'button',
          'aria-expanded': String(open),
          'aria-label': `${open ? 'Close' : 'Open'} ${name}`,
          'data-key': `twist:${id}`,
        },
        on: { click: () => this.#actions.toggle(id) },
      },
      twisty(),
    );
  }

  #row(
    label: Node | string,
    count: number,
    selection: Selection,
    depth: number,
    opener?: HTMLElement,
  ): HTMLElement {
    const folder = selection.kind === 'folder' ? selection.path : undefined;
    // With two panes nothing is listed beside the tree: the open note is the one marked.
    const current = !this.#model.two && same(this.#model.selection, selection);
    return atDepth(
      h(
        'li',
        { class: 'tree-row' },
        opener ?? h('span', { class: 'tree-row__twist' }),
        h(
          'button',
          {
            class: 'tree-row__name',
            attrs: {
              type: 'button',
              'aria-current': current ? 'true' : undefined,
              'aria-expanded':
                this.#model.two && opener
                  ? String(this.#model.open.has(openId(selection)))
                  : undefined,
              'data-key': keyOf(selection),
              'data-folder': folder,
              'aria-keyshortcuts': folder === undefined ? undefined : 'F2',
            },
            on: {
              click: () => this.#actions.select(selection),
              ...(folder === undefined ? {} : this.#folderEvents(folder)),
            },
          },
          h('span', { class: 'tree-row__label' }, label),
          folder !== undefined && this.#model.books.has(folder)
            ? h('span', { class: 'book-mark', text: 'Book' })
            : null,
          h('span', { class: 'count', text: count.toLocaleString() }),
        ),
      ),
      depth,
    );
  }

  /** The note rows under the open row `id` (with two panes), or a search's (RESULTS). */
  noteRows(id: string, depth: number): HTMLElement[] {
    const list =
      id === RESULTS
        ? this.#model.results
        : this.#model.two
          ? this.#model.notes.get(id)
          : undefined;
    const rows = list ? list.notes.map((note) => this.#note(note, depth, list, id)) : [];
    this.#cache.listed(id, depth, rows);
    return rows;
  }

  /** A note's row: the one drawn before if it shows the same (./row-cache.ts). */
  #note(note: ListedNote, depth: number, list: NoteList, under: string): HTMLElement {
    const look = lookOf(note, list, under, depth, this.#model.openNote);
    return this.#cache.row(noteRowKey(note, under), noteRowShows(note, look, this.#today), () =>
      noteRow(note, look, this.#actions),
    );
  }
}
