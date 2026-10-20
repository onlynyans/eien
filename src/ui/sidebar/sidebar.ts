// The sidebar: the vault's contents page. The seal (which shuts the sidebar
// to a strip, and opens it again), the vault's name and the search field,
// then the tree (./tree.ts); at the foot, day or night, the panes and the
// settings. The head and search field stay put; the rest redraws. A folder
// takes a dropped note, and has its own menu.

import type { SettingValues } from '../../core/config';
import type { FolderNode } from '../../core/vault';
import { h, type Props, wordButton } from '../dom';
import { isMenuKey, menuPoint } from '../list/row-events';
import { FolderField } from './folder-field';
import { keyOf, type TreeActions, type TreeModel, TreeRows } from './tree';

type Scheme = SettingValues['appearance.scheme'];

export interface SidebarModel extends TreeModel {
  readonly scheme: Scheme;
  /** News from the last action, when there's no note list to show it above. */
  readonly notice: string | null;
}

export interface SidebarActions extends TreeActions {
  /** The search field's words, a moment after typing stops; "" when cleared. */
  search(query: string): void;
  newFolder(): void;
  /** The name typed for a folder being renamed. */
  renameFolder(path: string, typed: string): void;
  scheme(scheme: Scheme): void;
  /** Three panes, or two. */
  panes(two: boolean): void;
  settings(): void;
  /** The seal: shut the sidebar to a strip, or open it again. */
  toggleSidebar(): void;
}

/** How long typing must pause before the search runs. */
const SEARCH_AFTER_MS = 150;

export class Sidebar {
  readonly element: HTMLElement;
  readonly #search: HTMLInputElement;
  readonly #clear: HTMLButtonElement;
  readonly #body = h('div', { class: 'sidebar__body' });
  readonly #actions: SidebarActions;
  #timer: ReturnType<typeof setTimeout> | undefined;
  #model: SidebarModel | null = null;
  /** Set while redrawing: a field taken out by a redraw isn't the writer leaving it. */
  #drawing = false;
  /** The folder being renamed in place. */
  readonly #folderField = new FolderField({
    drawing: () => this.#drawing,
    done: (folder, typed) => {
      // The keyboard goes back to the folder: under its new name once the rename is done
      // (refocusOn), under its own if the rename is refused.
      this.#refocus = keyOf({ kind: 'folder', path: folder.path });
      if (typed !== null) this.#actions.renameFolder(folder.path, typed);
      else if (this.#model) this.draw(this.#model);
    },
  });
  /** The control to give the keyboard back to after the next redraw, by its data-key. */
  #refocus: string | null = null;

  constructor(name: string, actions: SidebarActions, keys: string) {
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
    this.#clear = wordButton('Clear', () => this.#clearAndSearch(), {
      'aria-label': 'Clear search',
      hidden: true,
    });
    /** The seal as a button: it shuts the sidebar, and on the strip, opens it again. */
    const seal = (label: string, extra: string) =>
      h(
        'button',
        {
          class: `seal-button ${extra}`,
          attrs: { type: 'button', 'aria-label': label, title: `${label} (${keys})` },
          on: {
            click: () => {
              const had = document.activeElement === (extra === 'sidebar__show' ? show : hide);
              actions.toggleSidebar();
              // The seal that had the keyboard is hidden now: the other one, in its place, takes it.
              if (had) (extra === 'sidebar__show' ? hide : show).focus();
            },
          },
        },
        h('span', { class: 'seal', text: '永', attrs: { 'aria-hidden': 'true' } }),
      );
    const show = seal('Show sidebar', 'sidebar__show');
    const hide = seal('Hide sidebar', 'sidebar__hide');
    this.element = h(
      'aside',
      { class: 'sidebar', attrs: { 'aria-label': 'Vault' } },
      h('div', { class: 'sidebar__strip' }, show),
      h(
        'header',
        { class: 'sidebar__head' },
        hide,
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

  /**
   * Give the keyboard to the marked row (the selected one, or the open note),
   * or the first; with no rows (a search that found nothing), the first
   * control there, or the search field.
   */
  focusTree(): void {
    const rows = [...this.#body.querySelectorAll<HTMLElement>('.tree-row__name')];
    (
      rows.find((row) => row.getAttribute('aria-current') === 'true') ??
      rows[0] ??
      this.#body.querySelector<HTMLElement>('.sidebar__tree button') ??
      this.#search
    ).focus();
  }

  /** After a folder's rename: the keyboard goes to it, at `path`, with the next redraw. */
  refocusOn(path: string): void {
    this.#refocus = keyOf({ kind: 'folder', path });
  }

  /** Empty the field, without searching for nothing. */
  clearSearch(): void {
    clearTimeout(this.#timer);
    this.#search.value = '';
    this.#clear.hidden = true;
  }

  /** Rename the folder at `path` in place: its name becomes a field; Enter keeps it, Esc doesn't. */
  editFolder(path: string): void {
    this.#folderField.start(path);
    if (this.#model) this.draw(this.#model);
  }

  draw(model: SidebarModel): void {
    this.#model = model;
    // A redraw mustn't take the keyboard's place: the control that had it has it again; a
    // row that's gone (trashed, moved away) leaves it on the row now in its place.
    const active = document.activeElement;
    const inBody = active instanceof HTMLElement && this.#body.contains(active);
    const focused = this.#refocus ?? (inBody ? (active.dataset.key ?? null) : null);
    const rowsBefore = [...this.#body.querySelectorAll<HTMLElement>('.tree-row__name')];
    const focusedAt = this.#refocus === null && inBody ? rowsBefore.indexOf(active) : -1;
    this.#refocus = null;
    const actions = this.#actions;
    const rows = new TreeRows(model, actions, (folder) => this.#folderEvents(folder));
    const edit = (folder: FolderNode, depth: number) => this.#folderField.row(folder, depth);

    /** Day or Night; pressed again, back to the system's. */
    const schemeButton = (label: string, scheme: Scheme) =>
      wordButton(label, () => actions.scheme(model.scheme === scheme ? 'system' : scheme), {
        'aria-pressed': String(model.scheme === scheme),
        'data-key': `scheme:${scheme}`,
      });
    const panesButton = (label: string, two: boolean) =>
      wordButton(label, () => actions.panes(two), {
        'aria-pressed': String(model.two === two),
        'data-key': `panes:${two ? 'two' : 'three'}`,
      });

    const section = (label: string, items: HTMLElement[], control?: HTMLElement) =>
      items.length > 0 || control
        ? [
            h(
              'div',
              { class: 'sidebar__section' },
              h('p', { class: 'label sidebar__label', text: label }),
              control,
            ),
            h('ul', { class: 'tree' }, ...items),
          ]
        : [];

    const results = model.results;
    const tree = results
      ? [
          ...section(
            'Results',
            rows.results(results),
            h('span', { class: 'count', text: results.total.toLocaleString() }),
          ),
          results.total === 0
            ? h(
                'div',
                { class: 'sidebar__empty' },
                h('p', { text: 'No notes match.' }),
                wordButton('Clear search', () => this.#clearAndSearch(), {
                  'data-key': 'clear-search',
                }),
              )
            : null,
        ]
      : [
          ...section('Library', rows.library()),
          ...section(
            'Folders',
            rows.folders(model.tree, 0, edit),
            wordButton('New folder', actions.newFolder, {
              class: 'word-button sidebar__new',
              'data-key': 'new-folder',
            }),
          ),
          ...section('Tags', rows.tags(model.tags, 0)),
        ];

    this.#drawing = true;
    this.#body.replaceChildren(
      h('nav', { class: 'sidebar__tree', attrs: { 'aria-label': 'Notes' } }, ...tree),
      h(
        'footer',
        { class: 'sidebar__foot' },
        h('p', {
          class: 'sidebar__notice',
          text: model.notice ?? '',
          attrs: { role: 'status', hidden: !model.notice },
        }),
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
          wordButton('Settings', actions.settings, {
            'aria-haspopup': 'dialog',
            'data-key': 'settings',
          }),
        ),
        h(
          'div',
          { class: 'sidebar__foot-row' },
          h(
            'div',
            { class: 'sidebar__pair', attrs: { role: 'group', 'aria-label': 'Panes' } },
            panesButton('3 panes', false),
            panesButton('2 panes', true),
          ),
        ),
      ),
    );
    this.#drawing = false;
    if (focused !== null && !this.#folderField.active) {
      const same = [...this.#body.querySelectorAll<HTMLElement>('[data-key]')].find(
        (control) => control.dataset.key === focused,
      );
      const rows = [...this.#body.querySelectorAll<HTMLElement>('.tree-row__name')];
      (same ?? (focusedAt >= 0 ? rows[Math.min(focusedAt, rows.length - 1)] : undefined))?.focus();
    }
    // A redraw mustn't take the caret out of the name being typed.
    this.#folderField.restore(this.#body);
  }

  #clearAndSearch(): void {
    this.clearSearch();
    this.#actions.search('');
    this.#search.focus();
  }

  /** A folder's own menu and keys: right-click or the menu key; F2 renames it. */
  #folderEvents(folder: string): Props['on'] {
    return {
      contextmenu: (event) => {
        event.preventDefault();
        this.#actions.folderMenu(folder, menuPoint(event));
      },
      keydown: (event) => {
        if (isMenuKey(event)) this.#actions.folderMenu(folder, menuPoint(event));
        else if (event.key === 'F2') this.editFolder(folder);
        else return;
        event.preventDefault();
      },
    };
  }
}
