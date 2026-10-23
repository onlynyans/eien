// The sidebar of a shown vault (../sidebar/sidebar.ts) and what its rows,
// sections and fields do: choose a list (with two panes, open it in the tree
// too), filter by a tag, make, rename and move folders and tags.

import { nextState, stateOf, withTagState } from '../../core/tags';
import type { RowActions } from '../list/row-events';
import type { SearchField } from '../list/search-field';
import { filterFor, listKey, rememberFilter } from '../list/sorts';
import type { PaneLayout } from '../shell/panes';
import { Sidebar } from '../sidebar/sidebar';
import { type MenuContext, showFolderMenu, showTagMenu } from './menus';
import type { Navigation } from './navigation';
import type { orderActions } from './order-actions';
import type { Organizer } from './organize';
import type { PhoneView } from './phone-view';
import type { Selection } from './vault-state';

export interface VaultSidebarOf {
  /** The vault's name, at the sidebar's head. */
  readonly name: string;
  /** The key that shuts or opens it, for its seal's tooltip. */
  readonly keys: string;
  readonly search: SearchField;
  /** What a note's row does, in the tree as in the list. */
  readonly rows: RowActions;
  readonly nav: Navigation;
  readonly organizer: Organizer;
  readonly order: ReturnType<typeof orderActions>;
  /** Made after the sidebar, whose element they hold. */
  phone(): PhoneView;
  panes(): PaneLayout;
  menus(): MenuContext;
  /** Show the list chosen (three panes), arranging set aside. */
  choose(next: Selection): void;
  redraw(): void;
  drawTree(): void;
  /** Run a file operation, then read the vault again (one at a time). */
  act(operation: () => Promise<unknown>): Promise<void>;
  newFolder(parent: string): void;
}

export function vaultSidebar(of: VaultSidebarOf): Sidebar {
  const { nav, organizer, order } = of;
  const sidebar: Sidebar = new Sidebar(
    of.name,
    {
      ...of.rows,
      select: (next) => {
        of.phone().stack.show('list'); // on a phone, the notes chosen
        if (!of.panes().two) return of.choose(next);
        nav.chooseAndToggle(next);
        of.search.clear();
        of.redraw();
      },
      toggle: (id) => {
        nav.toggle(id);
        of.drawTree();
      },
      folderMenu: (path, at) => void showFolderMenu(of.menus(), path, at),
      tagMenu: (key, at) => showTagMenu(of.menus(), key, at),
      moveFolder: (path, how) => order.moveFolder(path, how),
      moveTag: (key, by) => order.moveTag(key, by),
      filterTag: (key, out) => {
        const list = listKey(nav.selection);
        const filter = filterFor(list);
        rememberFilter(list, withTagState(filter, key, nextState(stateOf(filter, key), out)));
        of.redraw();
      },
      newTag: (tag) => void of.act(() => organizer.makeTag(tag, true)),
      newFolder: () => of.newFolder(nav.selection.kind === 'folder' ? nav.selection.path : ''),
      renameFolder: (path, typed) =>
        void of.act(async () => {
          const to = await organizer.renameFolder(path, typed);
          // Where it is now: under the name the disk took (cleaned, or refused and kept).
          sidebar.refocusOn(to ?? path);
          if (to) nav.follow(path, to);
        }),
      toggleSidebar: () => of.panes().toggle('sidebar'),
    },
    of.keys,
    of.search,
  );
  return sidebar;
}
