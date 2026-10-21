// Drawing the sidebar and the note list from the vault as the window knows
// it. Each draw reads what it needs, then draws only if no newer draw has
// started meanwhile, so a slow search can't overwrite a newer list. With no
// list in sight (two panes, or the list shut), the tree shows what the list
// would: the notes, or what a search finds.

import { type ListActions, renderList } from '../list/list';
import { listKey, sortFor } from '../list/sorts';
import type { SettingsState } from '../settings/settings-state';
import type { PaneLayout } from '../shell/panes';
import type { Sidebar } from '../sidebar/sidebar';
import type { Navigation } from './navigation';
import type { Notice } from './notice';
import { treeNotes } from './tree-notes';
import type { VaultState } from './vault-state';

export interface DrawnParts {
  readonly state: VaultState;
  readonly nav: Navigation;
  readonly panes: PaneLayout;
  readonly settings: SettingsState;
  readonly sidebar: Sidebar;
  readonly list: HTMLElement;
  readonly notice: Notice;
  readonly listActions: ListActions;
  /** The note on the page. */
  openNote(): string | null;
  /** News for the page's status line, when no pane beside it is open to show it. */
  pageNews(text: string | null): void;
}

export class PaneDrawer {
  readonly #parts: DrawnParts;
  #sidebarTurn = 0;
  #listTurn = 0;
  #listOrdered = false;

  constructor(parts: DrawnParts) {
    this.#parts = parts;
  }

  /** Whether the list shows a folder in its own order, so its rows can be placed between. */
  get listOrdered(): boolean {
    return this.#listOrdered;
  }

  async all(): Promise<void> {
    await Promise.all([this.sidebar(), this.list()]);
  }

  async sidebar(): Promise<void> {
    const { state, nav, panes, settings, notice } = this.#parts;
    const turn = ++this.#sidebarTurn;
    const words = nav.query.trim();
    const listShown = !panes.isShut('list');
    const [notes, results] = await Promise.all([
      panes.two ? treeNotes(state, nav.open, settings.values['books.numerals']) : new Map(),
      words && !listShown ? state.search(words) : null,
    ]);
    if (turn !== this.#sidebarTurn) return;
    // The news shows above the list; with no list, at the sidebar's foot; with neither, on the page.
    this.#parts.pageNews(!listShown && panes.isShut('sidebar') ? notice.text : null);
    this.#parts.sidebar.draw({
      tree: state.tree,
      tags: state.tags,
      pinned: state.pins.length,
      selection: nav.selection,
      open: nav.open,
      two: panes.two,
      notes,
      results,
      openNote: this.#parts.openNote(),
      notice: listShown ? null : notice.text,
      scheme: settings.values['appearance.scheme'],
    });
  }

  async list(): Promise<void> {
    const { state, nav, panes, settings } = this.#parts;
    const turn = ++this.#listTurn;
    if (!panes.listKept) return; // out of sight: nothing to read for it
    const words = nav.query.trim();
    const notes = words
      ? await state.search(words)
      : await state.notesFor(
          nav.selection,
          settings.values['books.numerals'],
          sortFor(listKey(nav.selection)),
        );
    if (turn !== this.#listTurn) return;
    this.#listOrdered = notes.folder !== undefined && notes.sort === 'order' && !words;
    renderList(
      this.#parts.list,
      notes,
      this.#parts.openNote(),
      this.#parts.listActions,
      this.#parts.notice.text,
    );
  }
}
