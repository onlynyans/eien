// Where the writer is in the vault: the row chosen in the sidebar, the rows
// shown open, and the search's words. Kept apart from drawing, so a rename
// or a move can carry it along.

import { parentOf } from '../../core/paths';
import { followSorts } from '../list/sorts';
import { openId } from '../sidebar/tree';
import type { Selection } from './vault-state';

export class Navigation {
  #selection: Selection = { kind: 'all' };
  /** The search field's words; while there are any, the list (or the tree) shows what matches. */
  query = '';
  /** Rows shown open, by openId (../sidebar/tree.ts). */
  readonly open = new Set<string>();

  get selection(): Selection {
    return this.#selection;
  }

  /** Choose a row: the folders down to a chosen folder open, and any search ends. */
  choose(next: Selection): void {
    this.#selection = next;
    this.query = '';
    if (next.kind === 'folder') this.openTo(next.path);
  }

  /** With two panes a row holds its notes: choosing it opens it, or shuts it when it's open. */
  chooseAndToggle(next: Selection): void {
    const id = openId(next);
    const wasOpen = this.open.has(id);
    this.choose(next);
    if (wasOpen) this.open.delete(id);
    else this.open.add(id);
  }

  /** Open every folder down to `folder`, so its row shows. */
  openTo(folder: string): void {
    for (let at = folder; at; at = parentOf(at)) this.open.add(at);
  }

  toggle(id: string): void {
    if (!this.open.delete(id)) this.open.add(id);
  }

  /** Where a new note goes: the chosen folder, unless a search is shown; else the vault itself. */
  get folder(): string {
    return this.#selection.kind === 'folder' && !this.query ? this.#selection.path : '';
  }

  /** A folder renamed or moved: the open folders, the selection and the sorts follow it. */
  follow(from: string, to: string): void {
    const moved = (path: string) =>
      path === from || path.startsWith(`${from}/`) ? to + path.slice(from.length) : path;
    for (const id of [...this.open]) {
      if (moved(id) !== id) {
        this.open.delete(id);
        this.open.add(moved(id));
      }
    }
    if (this.#selection.kind === 'folder') {
      this.#selection = { kind: 'folder', path: moved(this.#selection.path) };
    }
    followSorts(from, to);
  }

  /** A folder went to the trash: if it, or a folder in it, was chosen, All Notes is. */
  unselect(path: string): void {
    const chosen = this.#selection;
    if (chosen.kind === 'folder' && (chosen.path === path || chosen.path.startsWith(`${path}/`))) {
      this.#selection = { kind: 'all' };
    }
  }
}
