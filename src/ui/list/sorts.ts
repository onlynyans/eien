// How each list is sorted, remembered on this device (spec §2: per-device
// state stays out of the vault): in the window's own storage.

import type { NoteSort, Selection } from '../vault/vault-state';

const KEY = 'eien.sorts';
const SORTS: readonly NoteSort[] = ['order', 'title', 'modified'];

/** The list a selection shows, as sorts are remembered by. */
export const listKey = (selection: Selection): string =>
  selection.kind === 'folder'
    ? `folder:${selection.path}`
    : selection.kind === 'tag'
      ? `tag:${selection.key}`
      : selection.kind;

function remembered(): Record<string, NoteSort> {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    if (typeof data !== 'object' || data === null) return {};
    return Object.fromEntries(
      Object.entries(data).filter((entry): entry is [string, NoteSort] =>
        SORTS.includes(entry[1] as NoteSort),
      ),
    );
  } catch {
    return {};
  }
}

/** The sort chosen for a list, if one was. */
export const sortFor = (list: string): NoteSort | undefined => remembered()[list];

export function rememberSort(list: string, sort: NoteSort): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...remembered(), [list]: sort }));
  } catch {
    // Storage refused: the sort holds until the window closes.
  }
}
