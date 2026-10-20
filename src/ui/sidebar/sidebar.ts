// The sidebar: the vault's contents page. Its name and the search field,
// then Library, Folders and Tags; at the foot, day or night, and the
// settings. The name and search field stay put; the rest redraws.

import type { SettingValues } from '../../core/config';
import type { TagNode } from '../../core/tags';
import type { FolderNode } from '../../core/vault';
import { h, wordButton } from '../dom';
import type { Selection } from '../vault/vault-state';

type Scheme = SettingValues['appearance.scheme'];

export interface SidebarModel {
  readonly tree: FolderNode;
  readonly tags: readonly TagNode[];
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
        h('span', { class: 'sidebar__vault', text: name }),
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

  draw(model: SidebarModel): void {
    const actions = this.#actions;
    const selected = (selection: Selection) =>
      model.selection.kind === selection.kind &&
      (selection.kind === 'all' ||
        (selection.kind === 'folder' &&
          model.selection.kind === 'folder' &&
          model.selection.path === selection.path) ||
        (selection.kind === 'tag' &&
          model.selection.kind === 'tag' &&
          model.selection.key === selection.key));

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

    const row = (
      label: Node | string,
      count: number,
      selection: Selection,
      depth = 0,
      opener?: HTMLElement,
    ) => {
      const item = h(
        'li',
        { class: 'tree-row' },
        opener ?? h('span', { class: 'tree-row__twist' }),
        h(
          'button',
          {
            class: 'tree-row__name',
            attrs: { type: 'button', 'aria-current': selected(selection) ? 'true' : undefined },
            on: { click: () => actions.select(selection) },
          },
          h('span', { class: 'tree-row__label' }, label),
          h('span', { class: 'count', text: count.toLocaleString() }),
        ),
      );
      // Through the style API: the security policy refuses style attributes.
      item.style.setProperty('--depth', String(depth));
      return item;
    };

    const folderRows = (node: FolderNode, depth: number): HTMLElement[] =>
      node.folders.flatMap((folder) => {
        const own = row(
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

    const section = (label: string, rows: HTMLElement[]) =>
      rows.length > 0
        ? [
            h('p', { class: 'label sidebar__label', text: label }),
            h('ul', { class: 'tree' }, ...rows),
          ]
        : [];

    this.#body.replaceChildren(
      h(
        'nav',
        { class: 'sidebar__tree', attrs: { 'aria-label': 'Notes' } },
        ...section('Library', [row('All Notes', model.tree.noteCount, { kind: 'all' })]),
        ...section('Folders', folderRows(model.tree, 0)),
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
  }
}
