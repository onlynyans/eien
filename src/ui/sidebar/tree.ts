// The sidebar's rows: Library (All Notes, Pinned), Folders and Tags. With
// two panes the tree lists the notes too: under an open folder, after its
// own folders, and under All Notes, Pinned and each tag; and a search's
// results take the tree's place while there's no note list to show them.

import type { TagNode } from '../../core/tags';
import type { FolderNode } from '../../core/vault';
import { h, type Props } from '../dom';
import { type RowActions, rowEvents, rowKeys } from '../list/row-events';
import { when } from '../list/when';
import type { ListedNote, NoteList, Selection } from '../vault/vault-state';

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

/** Sets a row's depth: through the style API, as the security policy refuses style attributes. */
export function atDepth<T extends HTMLElement>(item: T, depth: number): T {
  item.style.setProperty('--depth', String(depth));
  return item;
}

export class TreeRows {
  readonly #model: TreeModel;
  readonly #actions: TreeActions;
  /** A folder's own keys and menu, given by the sidebar (F2 renames it there). */
  readonly #folderEvents: (path: string) => Props['on'];

  constructor(model: TreeModel, actions: TreeActions, folderEvents: (path: string) => Props['on']) {
    this.#model = model;
    this.#actions = actions;
    this.#folderEvents = folderEvents;
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
      const [row] = this.#branch(
        folder.name,
        folder.name,
        folder.noteCount,
        selection,
        depth,
        parent,
      );
      return this.#model.open.has(folder.path)
        ? [row as HTMLElement, ...this.folders(folder, depth + 1, edit)]
        : [row as HTMLElement];
    });
    return [...own, ...this.#notes(openId({ kind: 'folder', path: node.path }), depth)];
  }

  tags(nodes: readonly TagNode[], depth: number): HTMLElement[] {
    return nodes.flatMap((tag) => {
      const label = h('span', {}, h('span', { class: 'tree-row__hash', text: '#' }), tag.name);
      const selection: Selection = { kind: 'tag', key: tag.key };
      const parent = tag.children.length > 0 || (this.#model.two && tag.count > 0);
      const [row, ...notes] = this.#branch(
        label,
        `#${tag.tag}`,
        tag.count,
        selection,
        depth,
        parent,
      );
      return this.#model.open.has(tagId(tag.key))
        ? [row as HTMLElement, ...this.tags(tag.children, depth + 1), ...notes]
        : [row as HTMLElement];
    });
  }

  /** A search's results, as note rows. */
  results(list: NoteList): HTMLElement[] {
    return list.notes.map((note) => this.#note(note, 0, list, 'results'));
  }

  /** A row, and with two panes, the notes under it when it's open. */
  #branch(
    label: Node | string,
    name: string,
    count: number,
    selection: Selection,
    depth = 0,
    // Library rows hold notes only with two panes; a folder or tag says whether it holds anything.
    parent = this.#model.two,
  ): HTMLElement[] {
    const id = openId(selection);
    const opener = parent ? this.#twist(id, name) : undefined;
    const row = this.#row(label, count, selection, depth, opener);
    const under =
      selection.kind === 'folder' || !this.#model.open.has(id) ? [] : this.#notes(id, depth + 1);
    return [row, ...under];
  }

  #twist(id: string, name: string): HTMLElement {
    const open = this.#model.open.has(id);
    return h('button', {
      class: 'tree-row__twist',
      text: open ? '▾' : '▸',
      attrs: {
        type: 'button',
        'aria-expanded': String(open),
        'aria-label': `${open ? 'Close' : 'Open'} ${name}`,
        'data-key': `twist:${id}`,
      },
      on: { click: () => this.#actions.toggle(id) },
    });
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
          h('span', { class: 'count', text: count.toLocaleString() }),
        ),
      ),
      depth,
    );
  }

  /** The notes listed under the open row `id`, with two panes. */
  #notes(id: string, depth: number): HTMLElement[] {
    const list = this.#model.two ? this.#model.notes.get(id) : undefined;
    return list ? list.notes.map((note) => this.#note(note, depth, list, id)) : [];
  }

  #note(note: ListedNote, depth: number, list: NoteList, under: string): HTMLElement {
    const ordered = list.folder !== undefined && list.sort === 'order';
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
              'aria-current': note.path === this.#model.openNote ? 'true' : undefined,
              // The same note can be under its folder, a tag and Pinned: each row has its own key.
              'data-key': `note:${under}:${note.path}`,
              'data-path': note.path,
              'aria-keyshortcuts': rowKeys(ordered),
            },
            on: rowEvents(note.path, this.#actions, ordered),
          },
          note.ordinal ? h('span', { class: 'tree-row__ord count', text: note.ordinal }) : null,
          h('span', { class: 'tree-row__label', text: note.title }),
          h('span', {
            class: 'count',
            text: list.kind === 'book' ? `${note.words.toLocaleString()} w` : when(note.modified),
          }),
        ),
      ),
      depth,
    );
  }
}
