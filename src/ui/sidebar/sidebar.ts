// The sidebar: the vault's contents page. The seal (which shuts the sidebar
// to a strip, and opens it again), the vault's name and, with no list in
// sight, the search field (../list/search-field.ts), then the tree
// (./tree.ts), in sections that fold (./sections.ts); at the foot, day or
// night, the panes and the settings. The head and search field stay put; the
// rest redraws. A folder takes a dropped note, and has its own menu.

import type { SettingValues } from '../../core/config';
import type { FolderNode } from '../../core/vault';
import { h, type Props, wordButton } from '../dom';
import { isMenuKey, menuPoint } from '../list/row-events';
import type { SearchField } from '../list/search-field';
import { FolderField } from './folder-field';
import { Folds } from './folds';
import { sidebarFoot } from './foot';
import { foldingSection, plainSection } from './sections';
import { sidebarSignature } from './signature';
import { keyOf, type TreeActions, type TreeModel, TreeRows } from './tree';

type Scheme = SettingValues['appearance.scheme'];

export interface SidebarModel extends TreeModel {
  readonly scheme: Scheme;
  /** News from the last action, when there's no note list to show it above. */
  readonly notice: string | null;
}

export interface SidebarActions extends TreeActions {
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

export class Sidebar {
  readonly element: HTMLElement;
  /** Where the search field goes when there's no list in sight. */
  readonly searchSlot = h('div', { class: 'sidebar__search' });
  readonly #search: SearchField;
  readonly #body = h('div', { class: 'sidebar__body' });
  readonly #actions: SidebarActions;
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
  /** What was last drawn (./signature.ts): the same again isn't rebuilt. */
  #drawn = '';
  /** Which sections are folded, on this device. */
  readonly #folds = new Folds();

  constructor(name: string, actions: SidebarActions, keys: string, search: SearchField) {
    this.#actions = actions;
    this.#search = search;
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
      this.searchSlot,
      this.#body,
    );
  }

  /**
   * Give the keyboard to the marked row (the selected one, or the open note),
   * or the first; with no rows (a search that found nothing), the first
   * control there, or the search field when it's here.
   */
  focusTree(): void {
    const rows = this.#shown('.tree-row__name');
    (
      rows.find((row) => row.getAttribute('aria-current') === 'true') ??
      rows[0] ??
      this.#shown('.sidebar__tree button')[0] ??
      this.searchSlot.querySelector<HTMLElement>('input')
    )?.focus();
  }

  /** After a folder's rename: the keyboard goes to it, at `path`, with the next redraw. */
  refocusOn(path: string): void {
    this.#refocus = keyOf({ kind: 'folder', path });
  }

  /** Rename the folder at `path` in place: its name becomes a field; Enter keeps it, Esc doesn't. */
  editFolder(path: string): void {
    this.#folds.set('folders', false); // a folder made under FOLDERS folded is named in sight
    this.#folderField.start(path);
    if (this.#model) this.draw(this.#model);
  }

  draw(model: SidebarModel): void {
    this.#model = model;
    // Nothing new to show, and nothing to give the keyboard to: the rows stay as they are.
    const signature = sidebarSignature(model, new Date().toDateString());
    const settled = this.#refocus === null && !this.#folderField.active;
    if (settled && signature === this.#drawn) return;
    this.#drawn = signature;
    // A redraw mustn't take the keyboard's place: the control that had it has it again; a
    // row that's gone (trashed, moved away) leaves it on the row now in its place.
    const active = document.activeElement;
    const inBody = active instanceof HTMLElement && this.#body.contains(active);
    const focused = this.#refocus ?? (inBody ? (active.dataset.key ?? null) : null);
    const rowsBefore = this.#shown('.tree-row__name');
    const focusedAt = this.#refocus === null && inBody ? rowsBefore.indexOf(active) : -1;
    this.#refocus = null;
    const actions = this.#actions;
    const rows = new TreeRows(model, actions, (folder) => this.#folderEvents(folder));
    const edit = (folder: FolderNode, depth: number) => this.#folderField.row(folder, depth);

    const results = model.results;
    const tree = results
      ? [
          plainSection(
            'Results',
            rows.results(results),
            h('span', { class: 'count', text: results.total.toLocaleString() }),
          ),
          results.total === 0
            ? h(
                'div',
                { class: 'sidebar__empty' },
                h('p', { text: 'No notes match.' }),
                wordButton('Clear search', () => this.#search.clearAndSearch(), {
                  'data-key': 'clear-search',
                }),
              )
            : null,
        ]
      : [
          ...foldingSection('library', 'Library', rows.library(), this.#folds),
          ...foldingSection(
            'folders',
            'Folders',
            rows.folders(model.tree, 0, edit),
            this.#folds,
            wordButton('New folder', actions.newFolder, {
              class: 'word-button sidebar__new',
              'data-key': 'new-folder',
            }),
          ),
          ...foldingSection('tags', 'Tags', rows.tags(model.tags, 0), this.#folds),
        ];

    this.#drawing = true;
    this.#body.replaceChildren(
      h('nav', { class: 'sidebar__tree', attrs: { 'aria-label': 'Notes' } }, ...tree),
      sidebarFoot(
        {
          notice: model.notice,
          noteCount: model.tree.noteCount,
          scheme: model.scheme,
          two: model.two,
        },
        actions,
      ),
    );
    this.#drawing = false;
    if (focused !== null && !this.#folderField.active) {
      const same = [...this.#body.querySelectorAll<HTMLElement>('[data-key]')].find(
        (control) => control.dataset.key === focused,
      );
      const rows = this.#shown('.tree-row__name');
      const visible = same?.closest('[hidden]') ? undefined : same;
      (
        visible ?? (focusedAt >= 0 ? rows[Math.min(focusedAt, rows.length - 1)] : undefined)
      )?.focus();
    }
    // A redraw mustn't take the caret out of the name being typed.
    this.#folderField.restore(this.#body);
  }

  /** The controls `selector` finds that are in sight: none in a folded section. */
  #shown(selector: string): HTMLElement[] {
    return [...this.#body.querySelectorAll<HTMLElement>(selector)].filter(
      (control) => !control.closest('[hidden]'),
    );
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
