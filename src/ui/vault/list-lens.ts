// The note list's lens in a shown vault (../list/lens-bar.ts): the list
// chosen, its sort and tag filter (kept per list on this device,
// ../list/sorts.ts), whether a folder's shows its subfolders' notes too (kept
// the same way), and arranging it in your order (Arrange mode), which lasts
// until Done, or until another list is chosen.

import type { Arrange, LensActions } from '../list/lens-bar';
import type { SearchField } from '../list/search-field';
import { listKey, rememberFilter, rememberNested, rememberSort } from '../list/sorts';
import { filterTags } from '../list/tag-filter-panel';
import type { SettingsState } from '../settings/settings-state';
import type { Navigation } from './navigation';
import type { Selection, VaultState } from './vault-state';

export interface ListLensOf {
  readonly nav: Navigation;
  /** Made after the lens, which its words choose with. */
  search(): SearchField;
  readonly state: VaultState;
  readonly settings: SettingsState;
  redraw(): void;
}

export interface ListLens {
  /** Show the list `next`: arranging set aside, the search cleared. */
  choose(next: Selection): void;
  readonly actions: Required<LensActions> & { clearSearch(): void };
  /** How the list's rows move now. */
  arrange(): Arrange;
}

export function listLens(of: ListLensOf): ListLens {
  const { nav, redraw } = of;
  /** Arranging the list now (Arrange mode): until Done, or another list is chosen. */
  let arranging = false;
  return {
    choose(next) {
      arranging = false;
      nav.choose(next);
      of.search().clear();
      redraw();
    },
    actions: {
      clearSearch: () => of.search().clearAndSearch(),
      sort: (sort) => {
        rememberSort(listKey(nav.selection), sort);
        redraw();
      },
      filter: (next) => {
        rememberFilter(listKey(nav.selection), next);
        redraw();
      },
      tags: () => filterTags(of.state.tags),
      arrange: (on) => {
        arranging = on;
        redraw();
      },
      nest: (on) => {
        rememberNested(listKey(nav.selection), on);
        redraw();
      },
    },
    arrange() {
      const mode = of.settings.values['lists.arranging'] === 'mode';
      return { mode, on: mode && arranging };
    },
  };
}
