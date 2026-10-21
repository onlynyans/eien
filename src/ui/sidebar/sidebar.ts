// The sidebar: the vault's contents page. The seal (which shuts the sidebar
// to a strip, and opens it again), the vault's name and, with no list in
// sight, the search field (../list/search-field.ts), then the tree
// (./tree.ts), in sections that fold (./sections.ts); at the foot
// (./foot.ts), the count and the window's controls. The head, search field
// and foot stay put; the tree redraws. A folder takes a dropped note, and has
// its own menu.

import { tagKey } from '../../core/tags';
import type { FolderNode } from '../../core/vault';
import { h, wordButton } from '../dom';
import { icon } from '../icons';
import type { SearchField } from '../list/search-field';
import { FolderField } from './folder-field';
import { Folds } from './folds';
import { SidebarFoot } from './foot';
import { drawLensSlot, type SlotLens } from './lens-slot';
import { RowCache } from './row-cache';
import { type FolderMove, folderRowEvents, tagRowEvents } from './row-keys';
import { foldingSection, plainSection } from './sections';
import { sidebarSignature } from './signature';
import { TagField } from './tag-field';
import { keyOf, RESULTS, type TreeActions, type TreeModel, TreeRows } from './tree';
import { TreeWindows } from './tree-windows';

export interface SidebarModel extends TreeModel {
  /** News from the last action, when there's no note list to show it above. */
  readonly notice: string | null;
}

export type { FolderMove } from './row-keys';

export interface SidebarActions extends TreeActions {
  /** Move a folder in your order, or out of or into a folder. */
  moveFolder(path: string, how: FolderMove): void;
  /** Move a tag one place up or down among the tags beside it. */
  moveTag(key: string, by: -1 | 1): void;
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
  /** With two panes, the chosen row's lens (../list/lens-bar.ts): its sort and tag filter. */
  readonly lens = h('div', { class: 'sidebar__lens', attrs: { hidden: true } });
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
    done: (folder, typed) => {
      // The keyboard goes back to the folder: under its new name once the rename is done
      // (refocusOn), under its own if the rename is refused.
      this.#refocus = keyOf({ kind: 'folder', path: folder.path });
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
      this.#refocus = tag ? keyOf({ kind: 'tag', key: tagKey(tag) }) : 'new-tag';
      if (tag) this.#actions.newTag(tag);
      else if (this.#model) this.draw(this.#model);
    },
  });
  /** The quiet + beside FOLDERS and TAGS (backlog #4): made once, so their tooltips are watched once. */
  readonly adders: readonly HTMLButtonElement[];
  readonly #addFolder: HTMLButtonElement;
  readonly #addTag: HTMLButtonElement;
  /** The control to give the keyboard back to after the next redraw, by its data-key. */
  #refocus: string | null = null;
  /** The frame last drawn (./signature.ts): the same again isn't rebuilt. */
  #drawn = '';
  /** The notes' rows last drawn, kept where they show the same. */
  readonly #rows = new RowCache();
  /** Which sections are folded, on this device. */
  readonly #folds = new Folds();
  /** Long lists of notes, drawn by the rows in sight, kept from draw to draw. */
  readonly #windows = new TreeWindows();

  constructor(name: string, actions: SidebarActions, keys: string, search: SearchField) {
    this.#actions = actions;
    this.#search = search;
    const adder = (label: string, key: string, run: () => void) =>
      h(
        'button',
        {
          class: 'icon-button sidebar__add',
          attrs: { type: 'button', 'aria-label': label, 'data-tip': label, 'data-key': key },
          on: { click: run },
        },
        icon('plus'),
      );
    this.#addFolder = adder('New folder', 'new-folder', () => actions.newFolder());
    this.#addTag = adder('New tag', 'new-tag', () => this.newTag());
    this.adders = [this.#addFolder, this.#addTag];
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
      this.lens,
      this.#body,
      this.foot.element,
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

  /** After a folder's rename or move: the keyboard goes to it, at `path` (or the row `key`), with the next redraw. */
  refocusOn(path: string | null, key?: string): void {
    this.#refocus = key ?? keyOf({ kind: 'folder', path: path ?? '' });
  }

  /** Rename the folder at `path` in place: its name becomes a field; Enter keeps it, Esc doesn't. */
  editFolder(path: string): void {
    this.#folds.set('folders', false); // a folder made under FOLDERS folded is named in sight
    this.#folderField.start(path);
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
    const settled = this.#refocus === null && !this.#folderField.active && !this.#tagField.active;
    const giveBack = this.#holdKeyboard();
    const actions = this.#actions;
    this.#rows.begin();
    this.#windows.begin();
    const rows = new TreeRows(
      model,
      actions,
      {
        folder: (path) =>
          folderRowEvents({
            menu: (at) => actions.folderMenu(path, at),
            rename: () => this.editFolder(path),
            move: (how) => actions.moveFolder(path, how),
          }),
        tag: (key) =>
          tagRowEvents({
            menu: (at) => actions.tagMenu(key, at),
            move: (by) => actions.moveTag(key, by),
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
    const edit = (folder: FolderNode, depth: number) => this.#folderField.row(folder, depth);

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
      : [
          ...foldingSection('library', 'Library', rows.library(), this.#folds),
          ...foldingSection(
            'folders',
            'Folders',
            rows.folders(model.tree, 0, edit),
            this.#folds,
            this.#addFolder,
          ),
          ...foldingSection(
            'tags',
            'Tags',
            [...rows.tags(model.tags, 0), ...this.#tagField.rows()],
            this.#folds,
            this.#addTag,
          ),
        ];

    this.#drawing = true;
    this.#body.replaceChildren(
      h('nav', { class: 'sidebar__tree', attrs: { 'aria-label': 'Notes' } }, ...tree),
    );
    this.#drawing = false;
    this.#rows.settle();
    // In the window now: each long list draws the rows in sight.
    this.#windows.settle();
    giveBack();
    // A redraw mustn't take the caret out of the name being typed.
    this.#folderField.restore(this.#body);
    this.#tagField.restore(this.#body);
  }

  /**
   * Where the keyboard is, before a redraw; the function returned gives it
   * back after. A redraw mustn't take the keyboard's place: the control that
   * had it has it again; a row that's gone (trashed, moved away) leaves it on
   * the row now in its place.
   */
  #holdKeyboard(): () => void {
    const active = document.activeElement;
    const inBody = active instanceof HTMLElement && this.#body.contains(active);
    const asked = this.#refocus;
    const focused = asked ?? (inBody ? (active.dataset.key ?? null) : null);
    const focusedAt =
      asked === null && inBody ? this.#shown('.tree-row__name').indexOf(active) : -1;
    this.#refocus = null;
    return () => {
      if (focused === null || this.#folderField.active || this.#tagField.active) return;
      // Still on the control it was on: rows put right around it, or not touched at all.
      if (asked === null && document.activeElement === active) return;
      const same = [...this.#body.querySelectorAll<HTMLElement>('[data-key]')].find(
        (control) => control.dataset.key === focused,
      );
      const visible = same?.closest('[hidden]') ? undefined : same;
      // A note's row in a long list may be out of sight, undrawn: its list brings it back.
      if (!visible && this.#windows.focusKey(focused)) return;
      const rows = visible || focusedAt < 0 ? [] : this.#shown('.tree-row__name');
      (visible ?? rows[Math.min(focusedAt, rows.length - 1)])?.focus();
    };
  }

  /** The controls `selector` finds that are in sight: none in a folded section. */
  #shown(selector: string): HTMLElement[] {
    return [...this.#body.querySelectorAll<HTMLElement>(selector)].filter(
      (control) => !control.closest('[hidden]'),
    );
  }
}
