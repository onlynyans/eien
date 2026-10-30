// The sidebar: the vault's contents page. The seal (which shuts the sidebar
// to a strip, and opens it again), the vault's name and, with no list in
// sight, the search field (../list/search-field.ts), then the tree
// (./tree.ts), in sections that fold (./sections.ts); at the foot
// (./foot.ts), the count and the window's controls. The head, search field
// and foot stay put; the tree redraws. A folder takes a dropped note, and has
// its own menu.

import { tagKey } from '../../core/tags';
import type { FolderNode } from '../../core/vault';
import { addButton } from '../add-button';
import { h, wordButton } from '../dom';
import type { SearchField } from '../list/search-field';
import { FolderField } from './folder-field';
import { type FolderActs, FolderSides } from './folder-sides';
import { type FolderSection, Folds } from './folds';
import { SidebarFoot } from './foot';
import { drawLensSlot, type LensSlot, type SlotLens } from './lens-slot';
import { RowCache } from './row-cache';
import { type FolderMove, tagRowEvents } from './row-keys';
import { seals } from './seals';
import { plainSection } from './sections';
import type { ShelfActions, ShelfModel } from './shelf-rows';
import { SidebarFocus } from './sidebar-focus';
import { sidebarSignature } from './signature';
import { TagField } from './tag-field';
import { keyOf, RESULTS, type TreeActions, type TreeModel, TreeRows } from './tree';
import { treeSections } from './tree-sections';
import { TreeWindows } from './tree-windows';

export interface SidebarModel extends TreeModel {
  /** News from the last action, when there's no note list to show it above. */
  readonly notice: string | null;
  /** SHELF (#40): the book on the active page, and with two panes the open book's contents. */
  readonly shelf: Omit<ShelfModel, 'tree'>;
}

export type { FolderMove } from './row-keys';

export interface SidebarActions extends TreeActions, ShelfActions {
  /** Move a folder in your order among the folders `section` shows beside it, or out of or into a folder. */
  moveFolder(path: string, how: FolderMove, section: FolderSection): void;
  /** Shut a folder on SHELF, or open it (#40). */
  foldShelf(path: string): void;
  /** Move a tag one place up or down among the tags beside it. */
  moveTag(key: string, by: -1 | 1): void;
  /** Lay a tag over the list showing (#32): moved on to the next state, or kept out at once. */
  filterTag(key: string, out: boolean): void;
  newFolder(): void;
  /** Make a tag no note carries yet (the + beside TAGS). */
  newTag(tag: string): void;
  /** A tag's menu, at the pointer or under the row. */
  tagMenu(key: string, at: { readonly x: number; readonly y: number }): void;
  /** The name typed for a folder being renamed. */
  renameFolder(path: string, typed: string): void;
  /** The seal: shut the sidebar to a strip, or open it again. */
  toggleSidebar(): void;
}

export class Sidebar {
  readonly element: HTMLElement;
  /** Where the search field goes when there's no list in sight. */
  readonly searchSlot = h('div', { class: 'sidebar__search' });
  /** With two panes, the chosen row's lens (../list/lens-bar.ts): its sort and tag filter, at the search field's end. */
  readonly lens: LensSlot = {
    tools: h('span', {
      class: 'list__tools sidebar__tools',
      attrs: { role: 'group', hidden: true },
    }),
    chips: h('div', { class: 'sidebar__lens', attrs: { hidden: true } }),
  };
  /** The count, and the window's controls the layout draws there. */
  readonly foot = new SidebarFoot();
  readonly #search: SearchField;
  readonly #body = h('div', { class: 'sidebar__body' });
  readonly #actions: SidebarActions;
  #model: SidebarModel | null = null;
  /** Set while redrawing: a field taken out by a redraw isn't the writer leaving it. */
  #drawing = false;
  /** The folder being renamed in place. */
  readonly #folderField = new FolderField({
    drawing: () => this.#drawing,
    done: (folder, typed, section) => {
      // The keyboard goes back to the folder, in the section it was renamed in: under its
      // new name once the rename is done (refocusOn), under its own if the rename is refused.
      this.#sides.from = section;
      this.#focus.asked = this.#sides.keys(folder.path);
      if (typed !== null) this.#actions.renameFolder(folder.path, typed);
      else if (this.#model) this.draw(this.#model);
    },
  });
  /** A tag being named in place, from the + beside TAGS. */
  readonly #tagField = new TagField({
    drawing: () => this.#drawing,
    known: () => {
      const keys = new Set<string>();
      const walk = (nodes: SidebarModel['tags']) => {
        for (const node of nodes) {
          keys.add(node.key);
          walk(node.children);
        }
      };
      walk(this.#model?.tags ?? []);
      return keys;
    },
    done: (tag) => {
      // The keyboard goes to the tag made, once it's there; or back to the +.
      this.#focus.asked = [tag ? keyOf({ kind: 'tag', key: tagKey(tag) }) : 'new-tag'];
      if (tag) this.#actions.newTag(tag);
      else if (this.#model) this.draw(this.#model);
    },
  });
  /** The quiet + beside FOLDERS and TAGS (backlog #4): made once, so their tooltips are watched once. */
  readonly adders: readonly HTMLButtonElement[];
  readonly #addFolder: HTMLButtonElement;
  readonly #addTag: HTMLButtonElement;
  /** Whether the tree drawn whole last was a search's results. */
  #drawnResults = false;
  /** The frame last drawn (./signature.ts): the same again isn't rebuilt. */
  #drawn = '';
  /** The notes' rows last drawn, kept where they show the same. */
  readonly #rows = new RowCache();
  /** Which sections are folded, on this device. */
  readonly #folds = new Folds();
  /** The section a folder's keys or menu were last used in (#40). */
  readonly #sides = new FolderSides();
  /** What a folder's menu and keys do, in FOLDERS and on SHELF alike. */
  readonly #acts: FolderActs = {
    menu: (path, at, section) => this.#actions.folderMenu(path, at, section),
    rename: (path) => this.editFolder(path),
    move: (path, how, section) => this.#actions.moveFolder(path, how, section),
  };
  /** Long lists of notes, drawn by the rows in sight, kept from draw to draw. */
  readonly #windows = new TreeWindows();
  /** Where the keyboard is, kept across redraws. */
  readonly #focus = new SidebarFocus(
    this.#body,
    this.#windows,
    this.searchSlot,
    () => this.#folderField.active || this.#tagField.active,
  );

  constructor(name: string, actions: SidebarActions, keys: string, search: SearchField) {
    this.#actions = actions;
    this.#sides.watch(this.#body);
    this.#search = search;
    this.#addFolder = addButton({
      label: 'New folder',
      key: 'new-folder',
      run: () => actions.newFolder(),
    });
    this.#addTag = addButton({ label: 'New tag', key: 'new-tag', run: () => this.newTag() });
    this.adders = [this.#addFolder, this.#addTag];
    const { show, hide } = seals(keys, () => actions.toggleSidebar());
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
      // The search field's row: the field, then (two panes) the chosen row's lens, quiet till hovered.
      h('div', { class: 'sidebar__find quiet-row' }, this.searchSlot, this.lens.tools),
      this.lens.chips,
      this.#body,
      this.foot.element,
    );
  }

  /** Give the keyboard to the marked row, or the first (./sidebar-focus.ts). */
  focusTree(): void {
    this.#focus.focusTree();
  }

  /** The sidebar shuts with the keyboard in it: the row it was on is where `focusTree` goes back to. */
  keepPlace(): void {
    this.#focus.keepPlace();
  }

  /**
   * After a folder's rename or move: the keyboard goes to it, at `path`, in
   * the section it was moved in or else the other (or to the row `key`), with the next redraw.
   */
  refocusOn(path: string | null, key?: string): void {
    this.#focus.asked = key ? [key] : this.#sides.keys(path ?? '');
  }

  /** Rename the folder at `path` in place, where it was asked from: its name becomes a field; Enter keeps it, Esc doesn't. */
  editFolder(path: string): void {
    const section = this.#model ? this.#sides.where(this.#model.tree, path) : 'folders';
    this.#folds.set(section, false); // a folder made in a folded section is named in sight
    this.#folderField.start(path, section);
    if (this.#model) this.draw(this.#model);
  }

  /** The chosen row's lens, with two panes; none (null) with three, or for a search. */
  drawLens(lens: SlotLens | null): void {
    drawLensSlot(this.lens, lens);
  }

  /** Name a new tag in place, at the end of TAGS (opened, if folded). */
  newTag(): void {
    this.#folds.set('tags', false);
    this.#tagField.start();
    this.#drawn = '';
    if (this.#model) this.draw(this.#model);
  }

  draw(model: SidebarModel): void {
    this.#model = model;
    this.foot.draw({ notice: model.notice, noteCount: model.tree.noteCount });
    const frame = sidebarSignature(model);
    const settled =
      this.#focus.asked === null && !this.#folderField.active && !this.#tagField.active;
    const giveBack = this.#focus.hold();
    const actions = this.#actions;
    this.#rows.begin();
    this.#windows.begin();
    const rows = new TreeRows(
      model,
      actions,
      {
        folder: (path) => this.#sides.events(path, 'folders', this.#acts),
        tag: (key) =>
          tagRowEvents({
            select: () => actions.select({ kind: 'tag', key }),
            menu: (at) => actions.tagMenu(key, at),
            move: (by) => actions.moveTag(key, by),
            filter: (out) => actions.filterTag(key, out),
          }),
      },
      this.#rows,
      this.#windows.group,
    );
    // The same frame, and nothing to give the keyboard to: only notes' rows change, in place;
    // a windowed list is given its rows again, and draws those in sight.
    if (settled && frame === this.#drawn && this.#rows.patch((id, at) => rows.noteRows(id, at))) {
      for (const [id, { depth }] of this.#windows.shown) rows.noteRows(id, depth);
      this.#windows.settle(false);
      giveBack();
      return;
    }
    // A tree drawn with a folder's name as a field, or to give the keyboard to, is drawn whole again.
    this.#drawn = settled ? frame : '';
    const edit = (folder: FolderNode, depth: number) =>
      this.#folderField.row(folder, depth, 'folders');

    const results = model.results;
    const tree = results
      ? [
          plainSection(
            'Results',
            rows.noteRows(RESULTS, 0),
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
      : treeSections({
          rows,
          folds: this.#folds,
          tree: model.tree,
          tags: model.tags,
          edit,
          addFolder: this.#addFolder,
          addTag: this.#addTag,
          madeTag: this.#tagField.rows(),
          shelf: { tree: model.tree, ...model.shelf },
          folders: {
            events: (path) => this.#sides.events(path, 'shelf', this.#acts),
            fold: (path) => actions.foldShelf(path),
            edit: (folder, depth) => this.#folderField.row(folder, depth, 'shelf'),
          },
          actions,
        });

    // The tree drawn whole is a new scroller: it takes the old one's scroll, or a folder opened
    // or closed would send it to the top (and the keyboard given back, a few rows from there).
    // A search's results start at the top.
    const scrolled =
      results || this.#drawnResults
        ? 0
        : (this.#body.querySelector('.sidebar__tree')?.scrollTop ?? 0);
    this.#drawnResults = results !== null;
    const nav = h('nav', { class: 'sidebar__tree', attrs: { 'aria-label': 'Notes' } }, ...tree);
    this.#drawing = true;
    this.#body.replaceChildren(nav);
    this.#drawing = false;
    nav.scrollTop = scrolled;
    this.#rows.settle();
    // In the window now: each long list draws the rows in sight.
    this.#windows.settle();
    giveBack();
    // A redraw mustn't take the caret out of the name being typed.
    this.#folderField.restore(this.#body);
    this.#tagField.restore(this.#body);
  }
}
