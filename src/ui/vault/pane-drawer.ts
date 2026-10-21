// Drawing the sidebar and the note list from the vault as the window knows
// it. Each draw reads what it needs, then draws only if no newer draw has
// started meanwhile, so a slow search can't overwrite a newer list. With no
// list in sight (two panes, or the list shut), the tree shows what the list
// would: the notes, or what a search finds. The search field goes with the
// list: in its band, it searches that list's notes; in the sidebar (no list
// in sight, or a phone, whose contents page holds it), the whole vault.

import { type Arrange, canDrag, lensParts } from '../list/lens-bar';
import { type ListActions, renderList } from '../list/list';
import { filterFor, listKey, sortFor } from '../list/sorts';
import type { SettingsState } from '../settings/settings-state';
import type { PaneLayout } from '../shell/panes';
import type { Sidebar } from '../sidebar/sidebar';
import { openId } from '../sidebar/tree';
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
  /** Where the list draws: under its search band. */
  readonly list: HTMLElement;
  /** Put the search field in the list's band (`inList`) or the sidebar, searching what `name` names. */
  placeSearch(inList: boolean, name: string): void;
  readonly notice: Notice;
  readonly listActions: ListActions;
  /** The note on the page. */
  openNote(): string | null;
  /** News for the page's status line, when no pane beside it is open to show it. */
  pageNews(text: string | null): void;
  /** How the list's rows move now (Arrange mode, and whether it's arranging). */
  arrange(): Arrange;
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

  /** Whether the search field is in the list's band, and so searches only that list's notes. */
  #searchInList(): boolean {
    const { state, nav, panes } = this.#parts;
    const inList = !panes.isShut('list') && !panes.phone;
    this.#parts.placeSearch(inList, inList ? state.nameOf(nav.selection) : state.name);
    return inList;
  }

  async sidebar(): Promise<void> {
    const { state, nav, panes, settings, notice } = this.#parts;
    const turn = ++this.#sidebarTurn;
    this.#searchInList();
    const words = nav.query.trim();
    const listShown = !panes.isShut('list');
    const [notes, results] = await Promise.all([
      panes.two ? treeNotes(state, nav.open, settings.values['books.numerals']) : new Map(),
      words && !listShown ? state.search(words) : null,
    ]);
    if (turn !== this.#sidebarTurn) return;
    // The news shows above the list; with no list, at the sidebar's foot; with neither, on the page.
    this.#parts.pageNews(!listShown && panes.isShut('sidebar') ? notice.text : null);
    // With two panes the tree lists the notes: the chosen row's lens is in the sidebar (#33).
    const chosen = panes.two && !results ? notes.get(openId(nav.selection)) : undefined;
    this.#parts.sidebar.drawLens(
      chosen
        ? { name: chosen.heading, ...lensParts(chosen, this.#parts.listActions, 'tree') }
        : null,
    );
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
      books: state.books,
      notice: listShown ? null : notice.text,
      filter: filterFor(listKey(nav.selection)),
    });
  }

  async list(): Promise<void> {
    const { state, nav, panes, settings } = this.#parts;
    const turn = ++this.#listTurn;
    const inList = this.#searchInList();
    if (!panes.listKept) return; // out of sight: nothing to read for it
    const words = nav.query.trim();
    const arrange = this.#parts.arrange();
    const key = listKey(nav.selection);
    // Arranging: your order shows, the lens set aside until Done.
    const notes = words
      ? await state.search(words, inList ? nav.selection : null)
      : await state.notesFor(
          nav.selection,
          settings.values['books.numerals'],
          arrange.on ? 'order' : sortFor(key),
          arrange.on ? undefined : filterFor(key),
        );
    if (turn !== this.#listTurn) return;
    this.#listOrdered = canDrag(notes, arrange) && !words;
    renderList(
      this.#parts.list,
      notes,
      this.#parts.openNote(),
      this.#parts.listActions,
      this.#parts.notice.text,
      arrange,
    );
  }
}
