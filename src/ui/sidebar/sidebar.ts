// The sidebar: the vault's contents page. Its name and the search field,
// then Library (All Notes, Pinned), Folders and Tags; at the foot, day or
// night, and the settings. The name and search field stay put; the rest
// redraws. A folder takes a dropped note, and has its own menu.

import type { SettingValues } from '../../core/config';
import type { TagNode } from '../../core/tags';
import type { FolderNode } from '../../core/vault';
import { h, wordButton } from '../dom';
import type { Selection } from '../vault/vault-state';

type Scheme = SettingValues['appearance.scheme'];

export interface SidebarModel {
  readonly tree: FolderNode;
  readonly tags: readonly TagNode[];
  /** How many notes are pinned (the row shows when there are some). */
  readonly pinned: number;
  readonly selection: Selection;
  /** Folder paths, and tag keys, shown open. */
  readonly open: ReadonlySet<string>;
  readonly scheme: Scheme;
}

export interface SidebarActions {
  select(selection: Selection): void;
  /** Open or close a folder (by path) or a tag (by "#" and its key). */
  toggle(id: string): void;
  /** The search field's words, a moment after typing stops; "" when cleared. */
  search(query: string): void;
  /** A folder's menu, at the pointer or under the row. */
  folderMenu(path: string, at: { readonly x: number; readonly y: number }): void;
  newFolder(): void;
  /** The name typed for a folder being renamed. */
  renameFolder(path: string, typed: string): void;
  scheme(scheme: Scheme): void;
  settings(): void;
}

/** How long typing must pause before the search runs. */
const SEARCH_AFTER_MS = 150;

/** The id a tag is opened by, apart from folder paths. */
export const tagId = (key: string): string => `#${key}`;

export class Sidebar {
  readonly element: HTMLElement;
  readonly #search: HTMLInputElement;
  readonly #clear: HTMLButtonElement;
  readonly #body = h('div', { class: 'sidebar__body' });
  readonly #actions: SidebarActions;
  #timer: ReturnType<typeof setTimeout> | undefined;
  #model: SidebarModel | null = null;
  /** The folder being renamed in place, and what's typed so far: kept across redraws. */
  #editing: { path: string; typed: string } | null = null;

  constructor(name: string, actions: SidebarActions) {
    this.#actions = actions;
    this.#search = h('input', {
      class: 'field',
      attrs: {
        type: 'search',
        placeholder: `Search ${name}`,
        'aria-label': `Search ${name}`,
        'aria-keyshortcuts': 'Meta+Shift+F Control+Shift+F',
        autocomplete: 'off',
        spellcheck: 'false',
      },
      on: {
        input: () => {
          this.#clear.hidden = !this.#search.value;
          clearTimeout(this.#timer);
          this.#timer = setTimeout(() => actions.search(this.#search.value), SEARCH_AFTER_MS);
        },
        keydown: (event) => {
          if (event.key !== 'Escape') return;
          if (!this.#search.value) this.#search.blur();
          else {
            this.clearSearch();
            actions.search('');
          }
        },
      },
    });
    this.#clear = wordButton(
      'Clear',
      () => {
        this.clearSearch();
        actions.search('');
        this.#search.focus();
      },
      { 'aria-label': 'Clear search', hidden: true },
    );
    this.element = h(
      'aside',
      { class: 'sidebar', attrs: { 'aria-label': 'Vault' } },
      h(
        'header',
        { class: 'sidebar__head' },
        h('span', { class: 'seal', text: '永', attrs: { 'aria-hidden': 'true' } }),
        // The vault itself takes a dropped note, out of whatever folder it was in.
        h('span', { class: 'sidebar__vault', text: name, attrs: { 'data-folder': '' } }),
      ),
      h('div', { class: 'sidebar__search', attrs: { role: 'search' } }, this.#search, this.#clear),
      this.#body,
    );
  }

  get query(): string {
    return this.#search.value;
  }

  focusSearch(): void {
    this.#search.focus();
    this.#search.select();
  }

  /** Empty the field, without searching for nothing. */
  clearSearch(): void {
    clearTimeout(this.#timer);
    this.#search.value = '';
    this.#clear.hidden = true;
  }

  /** Rename the folder at `path` in place: its name becomes a field; Enter keeps it, Esc doesn't. */
  editFolder(path: string): void {
    this.#editing = { path, typed: path.slice(path.lastIndexOf('/') + 1) };
    if (this.#model) this.draw(this.#model);
    const field = this.#body.querySelector<HTMLInputElement>('.tree-row__field');
    field?.focus();
    field?.select();
  }

  draw(model: SidebarModel): void {
    this.#model = model;
    // A redraw mustn't take the keyboard's place: the row that had focus has it again.
    const active = document.activeElement;
    const focused =
      active instanceof HTMLElement &&
      this.#body.contains(active) &&
      active.classList.contains('tree-row__name')
        ? (active.dataset.folder ?? active.textContent)
        : null;
    const actions = this.#actions;
    const same = (a: Selection, b: Selection) =>
      a.kind === b.kind &&
      (a.kind === 'all' ||
        a.kind === 'pinned' ||
        (a.kind === 'folder' && b.kind === 'folder' && a.path === b.path) ||
        (a.kind === 'tag' && b.kind === 'tag' && a.key === b.key));

    const twist = (id: string, name: string, hasChildren: boolean) => {
      if (!hasChildren) return h('span', { class: 'tree-row__twist' });
      const open = model.open.has(id);
      return h('button', {
        class: 'tree-row__twist',
        text: open ? '▾' : '▸',
        attrs: {
          type: 'button',
          'aria-expanded': String(open),
          'aria-label': `${open ? 'Close' : 'Open'} ${name}`,
        },
        on: { click: () => actions.toggle(id) },
      });
    };

    /** A folder's own menu and keys: right-click or the menu key; F2 renames it. */
    const folderEvents = (folder: string) => ({
      contextmenu: (event: MouseEvent) => {
        event.preventDefault();
        const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
        const fromKeys = event.clientX === 0 && event.clientY === 0;
        actions.folderMenu(
          folder,
          fromKeys ? { x: rect.left + 16, y: rect.bottom } : { x: event.clientX, y: event.clientY },
        );
      },
      keydown: (event: KeyboardEvent) => {
        if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
          const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
          actions.folderMenu(folder, { x: rect.left + 16, y: rect.bottom });
        } else if (event.key === 'F2') this.editFolder(folder);
        else return;
        event.preventDefault();
      },
    });

    const row = (
      label: Node | string,
      count: number,
      selection: Selection,
      depth = 0,
      opener?: HTMLElement,
    ) => {
      const folder = selection.kind === 'folder' ? selection.path : undefined;
      const item = h(
        'li',
        { class: 'tree-row' },
        opener ?? h('span', { class: 'tree-row__twist' }),
        h(
          'button',
          {
            class: 'tree-row__name',
            attrs: {
              type: 'button',
              'aria-current': same(model.selection, selection) ? 'true' : undefined,
              'data-folder': folder,
              'aria-keyshortcuts': folder === undefined ? undefined : 'F2',
            },
            on: {
              click: () => actions.select(selection),
              ...(folder === undefined ? {} : folderEvents(folder)),
            },
          },
          h('span', { class: 'tree-row__label' }, label),
          h('span', { class: 'count', text: count.toLocaleString() }),
        ),
      );
      // Through the style API: the security policy refuses style attributes.
      item.style.setProperty('--depth', String(depth));
      return item;
    };

    /** A folder being renamed: its name as a field. */
    const editRow = (folder: FolderNode, depth: number, typed: string) => {
      const field = h('input', {
        class: 'field tree-row__field',
        attrs: { type: 'text', 'aria-label': `Rename ${folder.name}`, spellcheck: 'false' },
      });
      field.value = typed;
      const finish = (keep: boolean) => {
        if (this.#editing?.path !== folder.path) return;
        this.#editing = null;
        const value = field.value;
        if (keep && value.trim() && value !== folder.name) actions.renameFolder(folder.path, value);
        else if (this.#model) this.draw(this.#model);
      };
      field.addEventListener('input', () => {
        if (this.#editing) this.#editing.typed = field.value;
      });
      field.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') finish(true);
        else if (event.key === 'Escape') finish(false);
        else return;
        event.preventDefault();
        event.stopPropagation();
      });
      // A redraw replaces the field: that isn't the writer leaving it.
      field.addEventListener('blur', () => {
        if (field.isConnected) finish(true);
      });
      const item = h('li', { class: 'tree-row' }, h('span', { class: 'tree-row__twist' }), field);
      item.style.setProperty('--depth', String(depth));
      return item;
    };

    const folderRows = (node: FolderNode, depth: number): HTMLElement[] =>
      node.folders.flatMap((folder) => {
        const own =
          this.#editing?.path === folder.path
            ? editRow(folder, depth, this.#editing.typed)
            : row(
                folder.name,
                folder.noteCount,
                { kind: 'folder', path: folder.path },
                depth,
                twist(folder.path, folder.name, folder.folders.length > 0),
              );
        return model.open.has(folder.path) ? [own, ...folderRows(folder, depth + 1)] : [own];
      });

    const tagRows = (nodes: readonly TagNode[], depth: number): HTMLElement[] =>
      nodes.flatMap((tag) => {
        const label = h('span', {}, h('span', { class: 'tree-row__hash', text: '#' }), tag.name);
        const own = row(
          label,
          tag.count,
          { kind: 'tag', key: tag.key },
          depth,
          twist(tagId(tag.key), `#${tag.tag}`, tag.children.length > 0),
        );
        return model.open.has(tagId(tag.key)) ? [own, ...tagRows(tag.children, depth + 1)] : [own];
      });

    /** Day or Night; pressed again, back to the system's. */
    const schemeButton = (label: string, scheme: Scheme) =>
      wordButton(label, () => actions.scheme(model.scheme === scheme ? 'system' : scheme), {
        'aria-pressed': String(model.scheme === scheme),
      });

    const section = (label: string, rows: HTMLElement[], control?: HTMLElement) =>
      rows.length > 0 || control
        ? [
            h(
              'div',
              { class: 'sidebar__section' },
              h('p', { class: 'label sidebar__label', text: label }),
              control,
            ),
            h('ul', { class: 'tree' }, ...rows),
          ]
        : [];

    const library = [row('All Notes', model.tree.noteCount, { kind: 'all' })];
    if (model.pinned > 0) library.push(row('Pinned', model.pinned, { kind: 'pinned' }));

    this.#body.replaceChildren(
      h(
        'nav',
        { class: 'sidebar__tree', attrs: { 'aria-label': 'Notes' } },
        ...section('Library', library),
        ...section(
          'Folders',
          folderRows(model.tree, 0),
          wordButton('New folder', actions.newFolder, { class: 'word-button sidebar__new' }),
        ),
        ...section('Tags', tagRows(model.tags, 0)),
      ),
      h(
        'footer',
        { class: 'sidebar__foot' },
        h('p', {
          class: 'count sidebar__count',
          text: `${model.tree.noteCount.toLocaleString()} notes`,
        }),
        h(
          'div',
          { class: 'sidebar__foot-row' },
          h(
            'div',
            { class: 'sidebar__pair', attrs: { role: 'group', 'aria-label': 'Day or night' } },
            schemeButton('Day', 'day'),
            schemeButton('Night', 'night'),
          ),
          wordButton('Settings', actions.settings, { 'aria-haspopup': 'dialog' }),
        ),
      ),
    );
    if (focused !== null && !this.#editing) {
      [...this.#body.querySelectorAll<HTMLElement>('.tree-row__name')]
        .find((row) => (row.dataset.folder ?? row.textContent) === focused)
        ?.focus();
    }
    // A redraw mustn't take the caret out of the name being typed.
    if (this.#editing) {
      const field = this.#body.querySelector<HTMLInputElement>('.tree-row__field');
      if (field && document.activeElement !== field) field.focus();
    }
  }
}
